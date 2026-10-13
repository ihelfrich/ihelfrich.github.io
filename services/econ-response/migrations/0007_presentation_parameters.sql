ALTER TABLE presentations ADD COLUMN measurement_parameters_json TEXT;
CREATE TRIGGER presentation_parameters_immutable BEFORE UPDATE OF measurement_parameters_json,model_version ON presentations
WHEN OLD.measurement_parameters_json IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Presentation measurement parameters are immutable'); END;
