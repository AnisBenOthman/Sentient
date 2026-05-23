import axios from 'axios';

import { authStore } from '../auth';
import { hrClient } from './client';

export const socialClient = axios.create({
  baseURL: (import.meta.env as Record<string, string>)['VITE_SOCIAL_URL'] ?? '/api/social',
  headers: { 'Content-Type': 'application/json' },
});

socialClient.interceptors.request.use((config) => {
  const token = authStore.getAccess();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let socialRefreshing: Promise<string> | null = null;

socialClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as { config?: { _retry?: boolean; headers: Record<string, string> }; response?: { status: number } };
    const original = axiosError.config;
    if (axiosError.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = authStore.getRefresh();
      if (!refreshToken) {
        authStore.clear();
        window.location.replace('/signin');
        return Promise.reject(error);
      }
      try {
        if (!socialRefreshing) {
          socialRefreshing = axios
            .post<{ accessToken: string; refreshToken: string }>(
              `${hrClient.defaults.baseURL}/auth/refresh`,
              { refreshToken },
            )
            .then((r) => {
              authStore.set(r.data.accessToken, r.data.refreshToken);
              return r.data.accessToken;
            })
            .finally(() => {
              socialRefreshing = null;
            });
        }
        const newToken = await socialRefreshing;
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return socialClient(original);
      } catch {
        authStore.clear();
        window.location.replace('/signin');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AnnouncementAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  departmentId: string;
  teamId: string | null;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED';
}

export interface AnnouncementResponse {
  id: string;
  title: string;
  body: string;
  audience: 'COMPANY' | 'DEPARTMENT' | 'TEAM';
  authorId: string;
  targetDepartmentId: string | null;
  targetTeamId: string | null;
  publishedAt: string;
  expiresAt: string | null;
  pinnedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  author: AnnouncementAuthor | null;
  isPinned: boolean;
}

export interface AnnouncementListResponse {
  items: AnnouncementResponse[];
  total: number;
}

// ── Request shapes ────────────────────────────────────────────────────────────

export interface ListAnnouncementsParams {
  page?: number;
  pageSize?: number;
  scope?: 'all';
  includeExpired?: boolean;
}

export interface CreateAnnouncementDto {
  title: string;
  body: string;
  audience: 'COMPANY' | 'DEPARTMENT' | 'TEAM';
  targetDepartmentId?: string;
  targetTeamId?: string;
  expiresAt?: string;
}

export interface UpdateAnnouncementDto {
  title?: string;
  body?: string;
  audience?: 'COMPANY' | 'DEPARTMENT' | 'TEAM';
  targetDepartmentId?: string;
  targetTeamId?: string;
  expiresAt?: string | null;
}

export interface PinAnnouncementDto {
  pinnedUntil: string | null;
}

// ── Error extraction ──────────────────────────────────────────────────────────

export function extractApiError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return '';
}

export const ANNOUNCEMENT_ERROR_MESSAGES: Record<string, string> = {
  UnsupportedAudienceInThisRelease: 'This audience type is not supported yet.',
  ExpiryInPast: 'The expiry date must be in the future.',
  TargetDepartmentRequired: 'A department must be specified for DEPARTMENT audience.',
  UnknownTargetDepartment: 'The selected department does not exist.',
  MissingTeamForTeamAudience: 'A team must be specified for TEAM audience.',
  UnknownTargetTeam: 'The selected team does not exist.',
  InconsistentAudienceTarget: 'Audience and targeting fields are inconsistent.',
  PinExpiryInPast: 'The pin expiry date must be in the future.',
  NotAnnouncementAuthor: 'You can only edit or delete your own announcements.',
};

// ── API functions ─────────────────────────────────────────────────────────────

export async function listAnnouncements(
  params?: ListAnnouncementsParams,
): Promise<AnnouncementListResponse> {
  const { data } = await socialClient.get<AnnouncementListResponse>('/announcements', { params });
  return data;
}

export async function getAnnouncement(id: string): Promise<AnnouncementResponse> {
  const { data } = await socialClient.get<AnnouncementResponse>(`/announcements/${id}`);
  return data;
}

export async function createAnnouncement(dto: CreateAnnouncementDto): Promise<AnnouncementResponse> {
  const { data } = await socialClient.post<AnnouncementResponse>('/announcements', dto);
  return data;
}

export async function updateAnnouncement(
  id: string,
  dto: UpdateAnnouncementDto,
): Promise<AnnouncementResponse> {
  const { data } = await socialClient.patch<AnnouncementResponse>(`/announcements/${id}`, dto);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await socialClient.delete(`/announcements/${id}`);
}

export async function pinAnnouncement(
  id: string,
  dto: PinAnnouncementDto,
): Promise<AnnouncementResponse> {
  const { data } = await socialClient.patch<AnnouncementResponse>(`/announcements/${id}/pin`, dto);
  return data;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export type DocumentCategory =
  | 'INTERNAL_POLICY'
  | 'HANDBOOK'
  | 'REGULATION'
  | 'TEMPLATE'
  | 'GUIDE'
  | 'OTHER';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'INTERNAL_POLICY',
  'HANDBOOK',
  'REGULATION',
  'TEMPLATE',
  'GUIDE',
  'OTHER',
];

export interface DocumentUploader {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export interface DocumentResponse {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: DocumentUploader | null;
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  items: DocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export const DOCUMENT_ERROR_MESSAGES: Record<string, string> = {
  MissingFile: 'No file was attached to the upload.',
  EmptyFile: 'The uploaded file is empty.',
  FileTooLarge: 'The file exceeds the 25 MiB size limit.',
  UnsupportedMimeType: 'File type is not supported. Use PDF, DOCX, TXT, MD, or HTML.',
  StorageUnavailable: 'Storage is temporarily unavailable. Please try again.',
  DocumentNotFound: 'Document not found.',
  DocumentFileMissing: 'The document file is no longer available on the server.',
};

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/html': '.html',
  };
  return map[mimeType] ?? '';
}

export async function listDocuments(params?: {
  page?: number;
  pageSize?: number;
  category?: DocumentCategory;
  search?: string;
}): Promise<DocumentListResponse> {
  const { data } = await socialClient.get<DocumentListResponse>('/documents', { params });
  return data;
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const { data } = await socialClient.get<DocumentResponse>(`/documents/${id}`);
  return data;
}

export async function createDocument(formData: FormData): Promise<DocumentResponse> {
  const { data } = await socialClient.post<DocumentResponse>('/documents', formData);
  return data;
}

export async function updateDocument(id: string, formData: FormData): Promise<DocumentResponse> {
  const { data } = await socialClient.patch<DocumentResponse>(`/documents/${id}`, formData);
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await socialClient.delete(`/documents/${id}`);
}

export async function downloadDocument(id: string, title: string, mimeType: string): Promise<void> {
  const response = await socialClient.get<Blob>(`/documents/${id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = title + mimeToExt(mimeType);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
