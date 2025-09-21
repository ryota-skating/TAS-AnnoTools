/**
 * API Service
 * HTTP client for backend API communication
 */

import type { 
  LoginRequest, 
  LoginResponse, 
  User, 
  VideoMetadata, 
  AnnotationData, 
  AnnotationSegment,
  LabelSet,
  PerformanceMetric
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiService {
  public token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('authToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log('API Request:', {
      url,
      method: options.method || 'GET',
      hasBody: !!options.body,
      headers: options.headers
    });
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as any).Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      console.log('API Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        throw new ApiError(
          response.status,
          errorData.message || 'API request failed',
          errorData
        );
      }

      const responseData = await response.json();
      console.log('API Success Response:', responseData);
      return responseData;
    } catch (error) {
      console.error('API Request Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'Network error occurred');
    }
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  async refreshToken(): Promise<{ token: string }> {
    const response = await this.request<{ token: string }>('/auth/refresh', {
      method: 'POST',
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  // Videos
  async getVideos(): Promise<{ videos: VideoMetadata[] }> {
    return this.request<{ videos: VideoMetadata[] }>('/videos');
  }

  async getVideo(id: string): Promise<{ video: VideoMetadata }> {
    console.log('ApiService: Getting video with ID:', id);
    const endpoint = `/videos/${id}`;
    console.log('ApiService: Request endpoint:', endpoint);
    return this.request<{ video: VideoMetadata }>(endpoint);
  }

  // Annotations
  async getAnnotations(videoId: string): Promise<AnnotationData> {
    return this.request<AnnotationData>(`/annotations/${videoId}`);
  }

  async getVideoAnnotations(videoId: string): Promise<AnnotationSegment[]> {
    const data = await this.request<AnnotationData>(`/annotations/${videoId}`);
    return data.segments || [];
  }

  async createAnnotationSegment(segment: Omit<AnnotationSegment, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnnotationSegment> {
    return this.request<AnnotationSegment>('/annotations/segments', {
      method: 'POST',
      body: JSON.stringify(segment),
    });
  }

  async updateAnnotationSegment(segmentId: string, segment: AnnotationSegment): Promise<AnnotationSegment> {
    return this.request<AnnotationSegment>(`/annotations/segments/${segmentId}`, {
      method: 'PUT',
      body: JSON.stringify(segment),
    });
  }

  async deleteAnnotationSegment(segmentId: string): Promise<void> {
    await this.request(`/annotations/segments/${segmentId}`, {
      method: 'DELETE',
    });
  }

  async saveAnnotations(
    videoId: string, 
    segments: AnnotationSegment[]
  ): Promise<{
    success: boolean;
    videoId: string;
    version: number;
    segmentCount: number;
    checksum: string;
  }> {
    return this.request(`/annotations/${videoId}`, {
      method: 'POST',
      body: JSON.stringify({ segments }),
    });
  }

  // New batch update method for frame-by-frame annotations
  async updateAnnotationBatch(
    videoFilename: string,
    labels: string[]
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    return this.request(`/annotations/${videoFilename}/batch`, {
      method: 'PUT',
      body: JSON.stringify({ labels }),
    });
  }

  // Load annotation data for a video
  async loadAnnotationData(
    videoFilename: string
  ): Promise<{
    success: boolean;
    data: {
      videoFilename: string;
      username: string;
      frameCount: number;
      labels: string[];
      lastModified: string;
    };
  }> {
    return this.request(`/annotations/${videoFilename}`);
  }

  async exportAnnotations(
    videoId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/annotations/${videoId}/export?format=${format}`,
      {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      }
    );

    if (!response.ok) {
      throw new ApiError(response.status, 'Export failed');
    }

    return response.blob();
  }

  // Labels
  async getLabelSet(project: string, mapping: string = 'default'): Promise<LabelSet> {
    return this.request<LabelSet>(`/labels/${project}?mapping=${mapping}`);
  }

  async updateLabelSet(project: string, items: any[], mapping: string = 'default'): Promise<{
    success: boolean;
    project: string;
    version: number;
    itemCount: number;
  }> {
    return this.request(`/labels/${project}`, {
      method: 'POST',
      body: JSON.stringify({ items, mapping }),
    });
  }

  async getActionElements(mapping: string = 'default'): Promise<{
    elements: any[];
    elementSets: any[];
    mapping: string;
    totalElements?: number;
  }> {
    return this.request(`/labels/elements/all?mapping=${mapping}`);
  }

  // Backward compatibility
  async getFigureSkatingElements(): Promise<{
    elements: any[];
    elementSets: any[];
  }> {
    return this.getActionElements('default');
  }

  // Mapping management
  async getAvailableMappings(): Promise<{
    mappings: Array<{
      name: string;
      displayName: string;
      isDefault: boolean;
    }>;
  }> {
    return this.request('/labels/mappings');
  }

  async validateMapping(mapping: string): Promise<{
    mapping: string;
    valid: boolean;
    errors: string[];
  }> {
    return this.request(`/labels/mappings/${mapping}/validate`);
  }

  // Performance
  async recordPerformanceMetric(metric: PerformanceMetric): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/performance/metrics', {
      method: 'POST',
      body: JSON.stringify(metric),
    });
  }

  async getPerformanceSummary(timeRange: '1h' | '24h' | '7d' = '1h'): Promise<{
    timeRange: string;
    metrics: any[];
    slaCompliance: any;
    overallHealth: boolean;
  }> {
    return this.request(`/performance/summary?timeRange=${timeRange}`);
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();
export { ApiError };