import { useState } from 'react';
import { jobAPI } from '../utils/api';

/**
 * Encapsulates the multi-step culture document upload workflow.
 *
 * @param {object} jobDetails       - current job details from parent state
 * @param {function} setJobDetails  - setter for parent job details state
 * @param {function} showSuccess    - callback to show a success message
 */
export function useCultureDocumentUpload({ jobDetails, setJobDetails, showSuccess }) {
  const [cultureDialogOpen, setCultureDialogOpen] = useState(false);
  const [cultureDialogStep, setCultureDialogStep] = useState('upload'); // 'upload' | 'confirm'
  const [cultureFile, setCultureFile] = useState(null);
  const [cultureUploading, setCultureUploading] = useState(false);
  const [cultureUploadError, setCultureUploadError] = useState('');
  const [pendingStrengths, setPendingStrengths] = useState([]);
  const [cliftonSaving, setCliftonSaving] = useState(false);

  const handleOpenCultureDialog = () => {
    if (
      jobDetails?.culture_strengths_status === 'pending_review' &&
      jobDetails?.suggested_clifton_strengths?.length > 0
    ) {
      setPendingStrengths(jobDetails.suggested_clifton_strengths.map((s) => s.strength));
      setCultureDialogStep('confirm');
    } else {
      setCultureFile(null);
      setCultureUploadError('');
      setCultureDialogStep('upload');
    }
    setCultureDialogOpen(true);
  };

  const handleCultureDocUpload = async () => {
    if (!cultureFile) return;
    setCultureUploading(true);
    setCultureUploadError('');
    try {
      const res = await jobAPI.uploadCultureDocument(jobDetails.mongo_id, cultureFile);
      const data = res.data;
      setJobDetails((prev) => ({
        ...prev,
        culture_strengths_status: data.culture_strengths_status,
        suggested_clifton_strengths: data.suggested_clifton_strengths,
        culture_doc_filename: cultureFile.name,
      }));
      setPendingStrengths(data.suggested_clifton_strengths.map((s) => s.strength));
      setCultureDialogStep('confirm');
    } catch (err) {
      setCultureUploadError(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setCultureUploading(false);
    }
  };

  const handleConfirmStrengths = async () => {
    setCliftonSaving(true);
    try {
      await jobAPI.updateCliftonStrengths(jobDetails.mongo_id, pendingStrengths);
      const res = await jobAPI.getDetails(jobDetails.company, jobDetails.title);
      setJobDetails(res.data.job);
      setCultureDialogOpen(false);
      showSuccess('CliftonStrengths confirmed and culture embedding generated');
    } catch (err) {
      setCultureUploadError(err?.response?.data?.detail || 'Save failed');
    } finally {
      setCliftonSaving(false);
    }
  };

  const handleCloseCultureDialog = () => setCultureDialogOpen(false);

  return {
    cultureDialogOpen,
    setCultureDialogOpen,
    cultureDialogStep,
    cultureFile,
    setCultureFile,
    cultureUploading,
    cultureUploadError,
    setCultureUploadError,
    pendingStrengths,
    setPendingStrengths,
    cliftonSaving,
    handleOpenCultureDialog,
    handleCultureDocUpload,
    handleConfirmStrengths,
    handleCloseCultureDialog,
  };
}
