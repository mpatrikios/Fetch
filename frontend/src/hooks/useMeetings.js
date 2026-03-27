import { useState, useEffect, useCallback } from 'react';
import { meetingAPI } from '../utils/api';

export function useMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await meetingAPI.getUpcoming();
      setMeetings(response.data.meetings || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return { meetings, loading, error };
}
