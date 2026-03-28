import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/services/api';
import { 
  getCertifications, 
  getCertificationById, 
  createCertification, 
  updateCertification, 
  deleteCertification 
} from '@/services/certifications';

// Mock axios instance used in the service
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Frontend Certification Service', () => {
  const mockCert = { id: '1', name: 'Test', provider: 'AWS', code: 'T1', isActive: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCertifications', () => {
    it('should fetch all active certifications by default', async () => {
      (api.get as any).mockResolvedValueOnce({ data: [mockCert] });
      const result = await getCertifications();
      expect(api.get).toHaveBeenCalledWith('/certifications?includeInactive=false');
      expect(result).toEqual([mockCert]);
    });

    it('should include inactive if requested', async () => {
      (api.get as any).mockResolvedValueOnce({ data: [mockCert] });
      await getCertifications(true);
      expect(api.get).toHaveBeenCalledWith('/certifications?includeInactive=true');
    });
  });

  describe('createCertification', () => {
    it('should send POST with data', async () => {
      const data = { name: 'New', providerId: 'provider-1', code: 'T2' };
      (api.post as any).mockResolvedValueOnce({ data: { ...data, id: '2' } });
      const result = await createCertification(data);
      expect(api.post).toHaveBeenCalledWith('/certifications', data);
      expect(result.id).toBe('2');
    });
  });

  describe('deleteCertification', () => {
    it('should send DELETE request', async () => {
      (api.delete as any).mockResolvedValueOnce({ data: mockCert });
      await deleteCertification('1');
      expect(api.delete).toHaveBeenCalledWith('/certifications/1');
    });
  });
});
