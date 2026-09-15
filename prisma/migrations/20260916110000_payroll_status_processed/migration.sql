-- Add PROCESSED to PayrollStatus (generate route marks generated periods PROCESSED)
ALTER TYPE "PayrollStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';
