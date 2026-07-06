-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_currentDriverId_fkey";

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
