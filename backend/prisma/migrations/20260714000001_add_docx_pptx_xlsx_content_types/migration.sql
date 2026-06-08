-- Add DOCX, PPTX, XLSX to MaterialContentType enum
-- PostgreSQL requires ALTER TYPE for enum additions
ALTER TYPE "MaterialContentType" ADD VALUE IF NOT EXISTS 'DOCX';
ALTER TYPE "MaterialContentType" ADD VALUE IF NOT EXISTS 'PPTX';
ALTER TYPE "MaterialContentType" ADD VALUE IF NOT EXISTS 'XLSX';
