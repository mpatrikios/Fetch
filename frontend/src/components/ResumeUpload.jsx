import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Description,
} from '@mui/icons-material';
import { resumeAPI } from '../utils/api';

const ResumeUpload = ({ onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (selectedFile) => {
    if (!selectedFile) return { valid: false, error: 'No file selected' };
    
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = selectedFile.name.toLowerCase().substr(selectedFile.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      return { valid: false, error: 'Please upload a PDF, DOC, or DOCX file' };
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }
    
    return { valid: true };
  };

  const handleFileSelect = (selectedFile) => {
    const validation = validateFile(selectedFile);
    
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setFile(selectedFile);
    setError(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    
    try {
      const response = await resumeAPI.upload(file);
      setFile(null);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };


  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center" color="primary">
        Upload Your Resume
      </Typography>
    
      <Box
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: dragActive ? 'primary.50' : 'grey.50',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          mb: 3,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'primary.50',
          },
        }}
      >
        <CloudUpload sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        
        <Typography variant="h6" gutterBottom>
          {file ? file.name : 'Drag & drop your resume here'}
        </Typography>
        
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => handleFileSelect(e.target.files[0])}
          style={{ display: 'none' }}
          id="file-input"
        />
        
        <label htmlFor="file-input">
          <Button variant="contained" component="span" sx={{ mt: 2 }}>
            Browse Files
          </Button>
        </label>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Accepted: PDF, DOC, DOCX (Max 10MB)
        </Typography>
      </Box>

      {file && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <IconButton color="inherit" size="small" onClick={() => setFile(null)}>
              <Delete />
            </IconButton>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Description sx={{ mr: 1 }} />
            {file.name}
          </Box>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ position: 'relative' }}>
        <Button
          variant="contained"
          color="secondary"
          fullWidth
          size="large"
          onClick={handleUpload}
          disabled={!file || uploading}
          startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
        >
          {uploading ? 'Processing...' : 'Upload Resume'}
        </Button>
        
        {uploading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius: 1,
            }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default ResumeUpload;