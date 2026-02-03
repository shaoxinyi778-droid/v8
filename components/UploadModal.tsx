import React, { useEffect, useState, useRef } from 'react';
import { LogItem, Video, Project } from '../types';
import { saveVideoFile } from '../utils/db';

// Declare globals for TFJS/COCO-SSD loaded via script tags
declare global {
  interface Window {
    cocoSsd: any;
  }
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (newVideos: Video[]) => void;
  projects?: Project[];
  initialProjectId?: number;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onComplete, projects = [], initialProjectId }) => {
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetProjectId, setTargetProjectId] = useState<string>(''); // empty string = all/uncategorized

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('准备上传...');
  const [logs, setLogs] = useState<LogItem[]>([]);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Model reference
  const detectorRef = useRef<any>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setUploadState('idle');
      setSelectedFiles([]);
      setProgress(0);
      setStatusText('准备上传...');
      setLogs([]);
      setTargetProjectId(initialProjectId ? initialProjectId.toString() : '');
      
      // Preload model if not already loaded
      if (!detectorRef.current && window.cocoSsd) {
         window.cocoSsd.load().then((model: any) => {
           detectorRef.current = model;
           console.log("COCO-SSD model loaded successfully");
         }).catch((err: any) => {
           console.error("Failed to load COCO-SSD model", err);
         });
      }
    }
  }, [isOpen, initialProjectId]);

  // Scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addLog = (text: string, type: LogItem['type']) => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), text, type }]);
  };

  const startUpload = () => {
    if (selectedFiles.length === 0) return;
    setUploadState('uploading');
    processFiles();
  };

  // --- Helper: Format duration from seconds to MM:SS ---
  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Helper: Get Video Metadata & Frame (Optimized for Memory) ---
  const extractVideoData = async (file: File): Promise<{
    durationStr: string;
    orientation: 'portrait' | 'landscape';
    width: number;
    height: number;
    thumbnailBase64: string;
  }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      // Timeout safety
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Video load timeout"));
      }, 10000);

      video.onloadedmetadata = () => {
        // Seek to 0.5s to get a valid frame
        video.currentTime = 0.5;
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        
        // --- OPTIMIZATION: Resize Canvas ---
        // Large videos (4K) create massive Base64 strings that crash LocalStorage/Memory.
        // We resize thumbnails to a max width (e.g., 360px) which is enough for the grid.
        const MAX_THUMB_WIDTH = 360;
        const scale = Math.min(1, MAX_THUMB_WIDTH / video.videoWidth);
        const drawWidth = video.videoWidth * scale;
        const drawHeight = video.videoHeight * scale;

        const canvas = document.createElement('canvas');
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
          
          // --- OPTIMIZATION: Compress JPEG ---
          // Use JPEG at 0.6 quality instead of PNG. Drastically reduces size.
          const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.6);
          
          const durationStr = formatDuration(video.duration || 0);
          const orientation = video.videoWidth < video.videoHeight ? 'portrait' : 'landscape';
          
          // Clean up video element immediately
          URL.revokeObjectURL(video.src);
          video.remove();

          resolve({
            durationStr,
            orientation,
            width: video.videoWidth,
            height: video.videoHeight,
            thumbnailBase64
          });
        } else {
          URL.revokeObjectURL(video.src);
          reject(new Error("Canvas context error"));
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(video.src);
        reject(new Error("Video load error"));
      };
    });
  };

  // --- Helper: Local Object Detection (YOLO-like via COCO-SSD) ---
  const analyzeImageWithLocalModel = async (base64Image: string): Promise<{ hasHuman: boolean }> => {
    if (!detectorRef.current) {
      if (window.cocoSsd) {
        try {
           detectorRef.current = await window.cocoSsd.load();
        } catch(e) { 
           console.warn("Model load failed", e);
           return { hasHuman: false };
        }
      } else {
        return { hasHuman: false };
      }
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Image;
      img.onload = async () => {
        try {
          const predictions = await detectorRef.current.detect(img);
          const person = predictions.find((p: any) => p.class === 'person');
          resolve({ hasHuman: !!person });
        } catch (e) {
          console.error("Detection error:", e);
          resolve({ hasHuman: false });
        } finally {
            // Help GC
            img.src = ''; 
        }
      };
      img.onerror = () => {
        resolve({ hasHuman: false });
      }
    });
  };

  const processFiles = async () => {
    const totalSteps = selectedFiles.length * 3; // Upload -> Extract -> Analyze
    let completedSteps = 0;

    const updateProgress = () => {
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);
    };

    const finalProjectId = targetProjectId ? parseInt(targetProjectId) : undefined;
    const targetProjectName = projects.find(p => p.id === finalProjectId)?.name || "默认库";

    // Process one by one to save memory
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      // Create ObjectURL only when needed
      
      addLog(`[${i+1}/${selectedFiles.length}] 读取文件: ${file.name}`, 'loading');
      await new Promise(r => setTimeout(r, 100)); // Small yield to let UI breathe
      updateProgress();
      
      try {
        // Step 2: Extract Metadata & Thumbnail
        addLog(`生成优化的缩略图...`, 'loading');
        // Note: extractVideoData handles ObjectURL creation/revocation internally now
        const metadata = await extractVideoData(file);
        updateProgress();

        // Step 3: AI Analysis (Local Model)
        addLog(`正在进行 AI 分析...`, 'ai');
        const aiResult = await analyzeImageWithLocalModel(metadata.thumbnailBase64);
        updateProgress();

        // Step 4: Finalize
        const typeStr = metadata.orientation === 'portrait' ? '竖屏' : '横屏';
        const humanStr = aiResult.hasHuman ? '有人像' : '空镜';
        
        const colors = ["bg-orange-100", "bg-blue-100", "bg-pink-100", "bg-teal-100", "bg-yellow-50", "bg-gray-200", "bg-red-50", "bg-green-100", "bg-purple-100"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const heightClass = metadata.orientation === 'portrait' ? "aspect-[9/16]" : "aspect-video";
        
        const videoId = Date.now() + Math.random();

        // Save binary blob to IDB
        addLog(`写入本地数据库...`, 'loading');
        await saveVideoFile(videoId, file);

        // Construct video object
        // Create a temporary URL for immediate feedback, App.tsx handles hydration later
        const tempUrl = URL.createObjectURL(file); 
        
        const newVideo: Video = {
          id: videoId,
          title: file.name,
          duration: metadata.durationStr,
          orientation: metadata.orientation,
          hasHuman: aiResult.hasHuman,
          color: randomColor,
          heightClass: heightClass,
          uploadDate: new Date().toISOString().split('T')[0],
          url: tempUrl,
          thumbnail: metadata.thumbnailBase64,
          projectId: finalProjectId
        };

        // --- KEY FIX: INCREMENTAL SAVE ---
        // Send this SINGLE video to parent immediately. 
        // This ensures if the browser crashes on the next video, this one is saved.
        onComplete([newVideo]);

        addLog(`处理完成: ${file.name} -> 已保存`, 'done');

      } catch (err: any) {
        let errorMsg = `处理失败: ${file.name}`;
        if (err.name === 'QuotaExceededError' || (err.message && err.message.includes('quota'))) {
           errorMsg = `储存空间满 (LocalStorage/IDB)，无法保存: ${file.name}`;
           addLog(`错误: 浏览器存储配额已满`, 'loading');
        } else {
           addLog(errorMsg, 'loading');
        }
        console.error(err);
      }
    }

    setStatusText('队列全部结束');
    setProgress(100);
    setUploadState('complete');
    
    // Auto close after delay
    setTimeout(onClose, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300">
      <div className="bg-white rounded-xl shadow-2xl w-96 p-6 transform transition-transform duration-300 scale-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {uploadState === 'idle' ? '上传视频' : '正在处理'}
            {uploadState !== 'idle' && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-2">
                剩余 {selectedFiles.length - Math.floor((progress / 100) * selectedFiles.length)} 个
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
             <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        {uploadState === 'idle' ? (
          <div className="space-y-4">
            
            {/* Project Selector */}
            <div className="mb-2">
               <label className="block text-xs font-semibold text-gray-500 mb-1">归档到项目:</label>
               <select 
                 value={targetProjectId}
                 onChange={(e) => setTargetProjectId(e.target.value)}
                 className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
               >
                 <option value="">全部素材 (不归档)</option>
                 {projects.map(p => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                 ))}
               </select>
            </div>

            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-indigo-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input 
                type="file" 
                multiple 
                accept="video/*" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-700">点击或拖拽上传视频</p>
              <p className="text-xs text-gray-400 mt-1">支持 MP4, MOV 等常见格式</p>
              <p className="text-[10px] text-gray-300 mt-1">本地识别模型已就绪</p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">已选 {selectedFiles.length} 个文件:</p>
                <ul className="space-y-1">
                  {selectedFiles.map((file, idx) => (
                    <li key={idx} className="text-xs text-gray-700 flex items-center gap-2 truncate">
                      <i className="fa-regular fa-file-video text-gray-400"></i>
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              onClick={startUpload}
              disabled={selectedFiles.length === 0}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                selectedFiles.length > 0 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              开始智能分析与上传
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                <span>{statusText}</span>
                {progress < 100 && <i className="fa-solid fa-circle-notch fa-spin text-indigo-600"></i>}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Logs */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-40 overflow-y-auto custom-scrollbar" ref={logContainerRef}>
              <ul className="space-y-3 text-xs">
                {logs.length === 0 && <li className="text-gray-400 text-center py-4">等待队列开始...</li>}
                {logs.map((log) => {
                  let iconClass = '';
                  let colorClass = '';
                  switch(log.type) {
                    case 'loading': iconClass = 'fa-solid fa-cloud-arrow-up'; colorClass = 'text-blue-600'; break;
                    case 'success': iconClass = 'fa-solid fa-check'; colorClass = 'text-green-600'; break;
                    case 'ai': iconClass = 'fa-solid fa-microchip'; colorClass = 'text-purple-600'; break;
                    case 'done': iconClass = 'fa-solid fa-folder-open'; colorClass = 'text-gray-800 font-medium'; break;
                  }
                  return (
                    <li key={log.id} className="flex items-start gap-2 animate-pulse-once">
                      <span className={`${colorClass} mt-0.5`}><i className={iconClass}></i></span>
                      <span>{log.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};