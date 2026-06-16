export type VideoRecord = {
  video_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  file_size_bytes: number;
  fps: number;
  fps_tier: string;
  device_model: string;
  os_version: string;
  resolution: string;
  local_path: string;
  metadata: string;
  upload_state: string;
  attempt_count: number;
  last_error: string;
  last_attempted_at: string;
};

export type VideoUpdateInput = Partial<Omit<VideoRecord, 'video_id'>>;

export type PaginatedVideosResult = {
  items: VideoRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
};
