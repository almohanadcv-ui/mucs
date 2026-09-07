-- Optional English label/help for questions (bilingual toggle).
ALTER TABLE "questions" ADD COLUMN "labelEn"    TEXT;
ALTER TABLE "questions" ADD COLUMN "helpTextEn" TEXT;
