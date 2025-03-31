import React, { useState } from 'react';
import FileUpload from './FileUpload';
import Dashboard from './Dashboard';
import './App.css';

function App() {
  const [uploadData, setUploadData] = useState(null);

  return (
    <div className="app">
      <h1>Advanced Data Dashboard</h1>
      {!uploadData ? (
        <FileUpload onUpload={setUploadData} />
      ) : (
        <>
          <button 
            onClick={() => setUploadData(null)}
            className="reset-btn"
          >
            ↻ Upload New File
          </button>
          <Dashboard uploadData={uploadData} />
        </>
      )}
    </div>
  );
}

export default App;