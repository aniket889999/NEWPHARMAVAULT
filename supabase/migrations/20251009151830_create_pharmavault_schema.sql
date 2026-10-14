/*
  # PharmaVault Database Schema

  ## Overview
  Complete database schema for the PharmaVault medicine information platform supporting
  user authentication, medicine management, pharmacy operations, prescriptions, and analytics.

  ## New Tables

  ### 1. `profiles`
  Extended user profile information linked to auth.users
  - `id` (uuid, FK to auth.users) - User identifier
  - `name` (text) - Full name
  - `role` (text) - User role: patient, pharmacist, doctor, admin
  - `phone` (text) - Contact number
  - `address` (text) - Physical address
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `medicines`
  Comprehensive medicine information database
  - `id` (uuid, PK) - Medicine identifier
  - `name` (text) - Medicine name
  - `generic_name` (text) - Generic/scientific name
  - `manufacturer` (text) - Manufacturer name
  - `category` (text) - Medicine category
  - `description` (text) - Detailed description
  - `dosage` (text) - Dosage instructions
  - `strength` (text) - Strength/concentration
  - `dosage_form` (text) - Form (tablet, capsule, etc.)
  - `therapeutic_class` (text) - Therapeutic classification
  - `prescription_required` (boolean) - Requires prescription
  - `side_effects` (text[]) - Array of side effects
  - `used_for` (text[]) - Array of uses
  - `alternatives` (text[]) - Alternative medicines
  - `contraindications` (text[]) - Array of contraindications
  - `pregnancy_category` (text) - Pregnancy safety category
  - `price` (numeric) - Base price
  - `image_url` (text) - Product image URL
  - `cdsco_drug_code` (text) - Regulatory code
  - `fda_approval_number` (text) - Approval number
  - `regulatory_status` (text) - Approval status
  - `created_at` (timestamptz) - Record creation
  - `updated_at` (timestamptz) - Last update

  ### 3. `pharmacies`
  Pharmacy location and information
  - `id` (uuid, PK) - Pharmacy identifier
  - `name` (text) - Pharmacy name
  - `owner_id` (uuid, FK) - Owner user ID
  - `address` (text) - Physical address
  - `city` (text) - City
  - `state` (text) - State
  - `pincode` (text) - Postal code
  - `phone` (text) - Contact number
  - `email` (text) - Email address
  - `license_number` (text) - Pharmacy license
  - `latitude` (numeric) - GPS coordinate
  - `longitude` (numeric) - GPS coordinate
  - `operating_hours` (jsonb) - Operating schedule
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Record creation
  - `updated_at` (timestamptz) - Last update

  ### 4. `inventory`
  Real-time pharmacy inventory tracking
  - `id` (uuid, PK) - Inventory record ID
  - `pharmacy_id` (uuid, FK) - Pharmacy reference
  - `medicine_id` (uuid, FK) - Medicine reference
  - `quantity` (integer) - Available quantity
  - `batch_number` (text) - Batch identifier
  - `manufacturing_date` (date) - Manufacturing date
  - `expiry_date` (date) - Expiry date
  - `price` (numeric) - Selling price
  - `reorder_level` (integer) - Reorder threshold
  - `last_restocked` (timestamptz) - Last restock time
  - `created_at` (timestamptz) - Record creation
  - `updated_at` (timestamptz) - Last update

  ### 5. `prescriptions`
  User prescription records with NLP extraction
  - `id` (uuid, PK) - Prescription ID
  - `user_id` (uuid, FK) - Patient user ID
  - `doctor_name` (text) - Prescribing doctor
  - `doctor_license` (text) - Doctor's license
  - `prescription_date` (date) - Issue date
  - `image_url` (text) - Uploaded image URL
  - `extracted_text` (text) - OCR extracted text
  - `medicines` (jsonb) - Extracted medicine data
  - `notes` (text) - Additional notes
  - `status` (text) - Status: pending, verified, fulfilled
  - `verified_by` (uuid, FK) - Verifier user ID
  - `verified_at` (timestamptz) - Verification time
  - `created_at` (timestamptz) - Upload time
  - `updated_at` (timestamptz) - Last update

  ### 6. `medicine_comparisons`
  User medicine comparison history
  - `id` (uuid, PK) - Comparison ID
  - `user_id` (uuid, FK) - User who made comparison
  - `medicine_ids` (uuid[]) - Compared medicines
  - `comparison_data` (jsonb) - Comparison results
  - `created_at` (timestamptz) - Comparison time

  ### 7. `authenticity_checks`
  Medicine authenticity verification records
  - `id` (uuid, PK) - Check ID
  - `user_id` (uuid, FK) - User who performed check
  - `medicine_id` (uuid, FK) - Medicine checked
  - `batch_number` (text) - Batch number
  - `verification_code` (text) - Verification code
  - `is_authentic` (boolean) - Authenticity result
  - `checked_at` (timestamptz) - Check time

  ### 8. `disposal_requests`
  Expired medicine disposal management
  - `id` (uuid, PK) - Request ID
  - `pharmacy_id` (uuid, FK) - Pharmacy reference
  - `medicine_id` (uuid, FK) - Medicine reference
  - `quantity` (integer) - Quantity to dispose
  - `expiry_date` (date) - Medicine expiry date
  - `status` (text) - Status: pending, scheduled, completed
  - `scheduled_date` (date) - Disposal schedule
  - `completed_date` (date) - Completion date
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - Request creation
  - `updated_at` (timestamptz) - Last update

  ### 9. `shortage_predictions`
  Analytics for medicine shortage predictions
  - `id` (uuid, PK) - Prediction ID
  - `pharmacy_id` (uuid, FK) - Pharmacy reference
  - `medicine_id` (uuid, FK) - Medicine reference
  - `current_stock` (integer) - Current inventory
  - `predicted_shortage_date` (date) - Predicted shortage
  - `average_daily_usage` (numeric) - Usage rate
  - `recommended_reorder_quantity` (integer) - Reorder amount
  - `confidence_score` (numeric) - Prediction confidence
  - `created_at` (timestamptz) - Prediction time

  ## Security

  All tables have Row Level Security (RLS) enabled with appropriate policies:
  - Users can view their own data
  - Pharmacists can manage their pharmacy data
  - Doctors can access patient prescriptions
  - Public can view medicine information
  - Admins have full access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'pharmacist', 'doctor', 'admin')),
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create medicines table
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  generic_name text NOT NULL,
  manufacturer text NOT NULL,
  category text NOT NULL,
  description text,
  dosage text,
  strength text,
  dosage_form text,
  therapeutic_class text,
  prescription_required boolean DEFAULT false,
  side_effects text[],
  used_for text[],
  alternatives text[],
  contraindications text[],
  pregnancy_category text,
  price numeric(10, 2) DEFAULT 0,
  image_url text,
  cdsco_drug_code text,
  fda_approval_number text,
  regulatory_status text DEFAULT 'approved',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view medicines"
  ON medicines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage medicines"
  ON medicines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create pharmacies table
CREATE TABLE IF NOT EXISTS pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  address text NOT NULL,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  license_number text UNIQUE,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  operating_hours jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pharmacies"
  ON pharmacies FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Pharmacy owners can manage their pharmacy"
  ON pharmacies FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id) ON DELETE CASCADE,
  quantity integer DEFAULT 0,
  batch_number text,
  manufacturing_date date,
  expiry_date date,
  price numeric(10, 2),
  reorder_level integer DEFAULT 10,
  last_restocked timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pharmacists can manage their inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = inventory.pharmacy_id
      AND pharmacies.owner_id = auth.uid()
    )
  );

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_name text,
  doctor_license text,
  prescription_date date,
  image_url text,
  extracted_text text,
  medicines jsonb DEFAULT '[]'::jsonb,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'fulfilled')),
  verified_by uuid REFERENCES profiles(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prescriptions"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own prescriptions"
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors and pharmacists can view all prescriptions"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('doctor', 'pharmacist', 'admin')
    )
  );

-- Create medicine_comparisons table
CREATE TABLE IF NOT EXISTS medicine_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  medicine_ids uuid[],
  comparison_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medicine_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparisons"
  ON medicine_comparisons FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create comparisons"
  ON medicine_comparisons FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create authenticity_checks table
CREATE TABLE IF NOT EXISTS authenticity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id),
  batch_number text,
  verification_code text,
  is_authentic boolean,
  checked_at timestamptz DEFAULT now()
);

ALTER TABLE authenticity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own authenticity checks"
  ON authenticity_checks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create authenticity checks"
  ON authenticity_checks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create disposal_requests table
CREATE TABLE IF NOT EXISTS disposal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id),
  quantity integer NOT NULL,
  expiry_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed')),
  scheduled_date date,
  completed_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE disposal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pharmacists can view own disposal requests"
  ON disposal_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = disposal_requests.pharmacy_id
      AND pharmacies.owner_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can manage own disposal requests"
  ON disposal_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = disposal_requests.pharmacy_id
      AND pharmacies.owner_id = auth.uid()
    )
  );

-- Create shortage_predictions table
CREATE TABLE IF NOT EXISTS shortage_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id),
  current_stock integer,
  predicted_shortage_date date,
  average_daily_usage numeric(10, 2),
  recommended_reorder_quantity integer,
  confidence_score numeric(3, 2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shortage_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pharmacists can view own shortage predictions"
  ON shortage_predictions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = shortage_predictions.pharmacy_id
      AND pharmacies.owner_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy ON inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_disposal_requests_pharmacy ON disposal_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_disposal_requests_status ON disposal_requests(status);
