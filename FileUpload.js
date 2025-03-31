import React, { useState } from 'react';
import axios from 'axios';

const FileUpload = ({ onUpload }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setStatus({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:8000/upload', formData);
      if (response.data.success) {
        onUpload(response.data);
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    } finally {
      setStatus({ loading: false });
    }
  };

  return (
    <div className="uploader">
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files[0])}
          disabled={status.loading}
        />
        <button 
          type="submit" 
          disabled={!file || status.loading}
          className="upload-btn"
        >
          {status.loading ? 'Processing...' : 'Upload Data'}
        </button>
      </form>
      {status.error && <div className="error">{status.error}</div>}
    </div>
  );
};

export default FileUpload;