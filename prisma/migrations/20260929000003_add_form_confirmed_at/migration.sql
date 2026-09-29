-- Confirm subscription-form step: timestamp set by confirm_form after an Interested outcome.
ALTER TABLE "InspectionBooking" ADD COLUMN "formConfirmedAt" TIMESTAMP(3);
