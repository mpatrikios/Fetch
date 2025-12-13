#!/usr/bin/env python3
"""
Script to start ngrok and automatically update Calendly webhook
"""

import requests
import json
import os
import subprocess
import time
import signal
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

CALENDLY_ACCESS_TOKEN = os.getenv('CALENDLY_ACCESS_TOKEN')
CALENDLY_API_BASE = "https://api.calendly.com"

def get_ngrok_url():
    """Get the current ngrok URL from ngrok API"""
    try:
        response = requests.get('http://localhost:4040/api/tunnels')
        if response.status_code == 200:
            tunnels = response.json()['tunnels']
            for tunnel in tunnels:
                if tunnel['proto'] == 'https':
                    return tunnel['public_url']
        return None
    except:
        return None

def delete_existing_webhooks():
    """Delete existing webhook subscriptions"""
    if not CALENDLY_ACCESS_TOKEN:
        return
    
    headers = {
        'Authorization': f'Bearer {CALENDLY_ACCESS_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # Get organization URI
    response = requests.get(f"{CALENDLY_API_BASE}/users/me", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get user info for deleting webhooks: {response.status_code} - {response.text}")
        return
    
    org_uri = response.json()['resource']['current_organization']
    
    # List existing webhooks
    params = {'organization': org_uri, 'scope': 'organization'}
    response = requests.get(f"{CALENDLY_API_BASE}/webhook_subscriptions", headers=headers, params=params)
    
    if response.status_code == 200:
        webhooks = response.json().get('collection', [])
        for webhook in webhooks:
            # Delete each webhook
            webhook_id = webhook['uri'].split('/')[-1]
            delete_url = f"{CALENDLY_API_BASE}/webhook_subscriptions/{webhook_id}"
            requests.delete(delete_url, headers=headers)
            print(f"🗑️  Deleted old webhook: {webhook['url']}")

def create_webhook(webhook_url):
    """Create new webhook subscription"""
    if not CALENDLY_ACCESS_TOKEN:
        print("❌ No Calendly access token found")
        return False
    
    headers = {
        'Authorization': f'Bearer {CALENDLY_ACCESS_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # Get organization URI
    response = requests.get(f"{CALENDLY_API_BASE}/users/me", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get user info: {response.status_code}")
        return False
    
    org_uri = response.json()['resource']['current_organization']
    
    # Create webhook
    webhook_data = {
        'url': f"{webhook_url}/api/webhooks/calendly",
        'events': ['invitee.created'],
        'organization': org_uri,
        'scope': 'organization'
    }
    
    response = requests.post(
        f"{CALENDLY_API_BASE}/webhook_subscriptions",
        headers=headers,
        data=json.dumps(webhook_data)
    )
    
    if response.status_code == 201:
        print(f"✅ Webhook created: {webhook_url}/api/webhooks/calendly")
        return True
    else:
        print(f"❌ Failed to create webhook: {response.status_code}")
        return False

def start_ngrok():
    """Start ngrok and return the process"""
    print("🚀 Starting ngrok tunnel...")
    process = subprocess.Popen(['ngrok', 'http', '127.0.0.1:8000'], 
                             stdout=subprocess.PIPE, 
                             stderr=subprocess.PIPE)
    
    # Wait for ngrok to start
    time.sleep(3)
    return process

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print('\n👋 Shutting down...')
    sys.exit(0)

def main():
    print("🎯 Starting Development Server with Auto-Webhook")
    print("=" * 50)
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start ngrok
    ngrok_process = start_ngrok()
    
    # Get ngrok URL
    ngrok_url = None
    for attempt in range(10):  # Try for 10 seconds
        ngrok_url = get_ngrok_url()
        if ngrok_url:
            break
        time.sleep(1)
    
    if not ngrok_url:
        print("❌ Failed to get ngrok URL")
        ngrok_process.terminate()
        return
    
    print(f"🌐 ngrok URL: {ngrok_url}")
    
    # Clean up old webhooks and create new one
    print("🧹 Cleaning up old webhooks...")
    delete_existing_webhooks()
    
    print("📡 Creating new webhook...")
    if create_webhook(ngrok_url):
        print("\n🎉 Setup complete!")
        print(f"📋 Summary:")
        print(f"  - ngrok URL: {ngrok_url}")
        print(f"  - Webhook URL: {ngrok_url}/api/webhooks/calendly")
        print(f"  - Backend should be running on http://localhost:8000")
        print("\n💡 To start your backend, run in another terminal:")
        print("   cd backend && source venv/bin/activate && python -m uvicorn src.api.main:app --reload --port 8000")
        
        print("\n⏳ Keeping ngrok running... Press Ctrl+C to stop")
        
        try:
            # Keep the script running
            ngrok_process.wait()
        except KeyboardInterrupt:
            # Allow graceful shutdown on Ctrl+C; cleanup is handled in finally block
            pass
        finally:
            print("\n🛑 Stopping ngrok...")
            ngrok_process.terminate()
    
    else:
        print("💥 Failed to create webhook")
        ngrok_process.terminate()

if __name__ == "__main__":
    main()