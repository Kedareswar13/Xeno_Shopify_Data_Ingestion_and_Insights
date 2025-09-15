-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "signupOtp" TEXT,
ADD COLUMN     "signupOtpExpires" TIMESTAMP(3);
