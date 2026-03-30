import { useCallback, useState } from 'preact/hooks';

import type { Tour, TourStatus } from '../types.ts';
import { Api } from '../logic/api.ts';
import { detectDataType } from '../logic/utils.ts';

export function useUpload(addTour: (tour: Tour) => void) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = useCallback(
    async (
      file: File,
      options: { name?: string; sport?: string; status?: TourStatus },
    ) => {
      setUploading(true);
      setUploadError('');
      try {
        const dataType = detectDataType(file.name);
        const tour = await Api.uploadTour(file, dataType, options);
        addTour(tour);
        setShowUpload(false);
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
    },
    [addTour],
  );

  return {
    showUpload,
    setShowUpload,
    uploading,
    uploadError,
    handleUpload,
  } as const;
}
