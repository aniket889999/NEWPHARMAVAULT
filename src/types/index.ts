export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  category: string;
  description: string;
  dosage: string;
  sideEffects: string[];
  usedFor: string[];
  alternatives: string[];
  expiryDate: string;
  price: number;
  inStock: boolean;
  imageUrl: string;
  // New regulatory fields
  cdscoDrugCode?: string;
  fdaApprovalNumber?: string;
  regulatoryStatus: 'approved' | 'pending' | 'recalled' | 'discontinued';
  batchNumber?: string;
  manufacturingDate?: string;
  activeIngredients: ActiveIngredient[];
  contraindications: string[];
  interactions: DrugInteraction[];
  pregnancyCategory?: string;
  prescriptionRequired: boolean;
  strength: string;
  dosageForm: string;
  therapeuticClass: string;
  pharmacyInventory?: InventoryInfo[];
}

export interface ActiveIngredient {
  name: string;
  strength: string;
  unit: string;
}

export interface DrugInteraction {
  drugName: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
}

export interface InventoryInfo {
  pharmacyId: string;
  pharmacyName: string;
  location: string;
  quantity: number;
  price: number;
  lastUpdated: Date;
  distance?: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  medicines: PrescribedMedicine[];
  issueDate: Date;
  validUntil: Date;
  status: 'active' | 'filled' | 'expired' | 'cancelled';
  instructions: string;
  diagnosis?: string;
}

export interface PrescribedMedicine {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relatedMedicine?: string;
  messageType?: 'text' | 'prescription_analysis' | 'interaction_alert' | 'comparison';
  attachments?: MessageAttachment[];
  agentTrace?: string[];
  safetyWarnings?: string[];
  verified?: boolean | 'partially' | 'not_applicable';
  confidence?: number | null;
  responseType?: 'casual' | 'medical' | 'emergency';
  showTrustLayer?: boolean;
  explanation?: {
    answerSummary: string;
    confidenceBreakdown: {
      graphEvidence: number;
      inventoryEvidence: number;
      prescriptionConfirmation: number;
      verificationScore: number;
      finalConfidence: number;
    };
    verificationStatus: string | boolean;
    evidenceSources: string[];
    reasoningSteps: string[];
    graphRelationships?: {
      name: string;
      generic: string;
      treats: string[];
      alternatives: string[];
      sideEffects: string[];
      cautions: string[];
    }[];
    patientIntelligenceData?: any;
    safetyChecks: string[];
    safetyData?: {
      hallucinationRisk: string;
      riskClass: string;
      unsupportedClaims: any[];
      contradictionFlags: string[];
      reviewRequired: boolean;
      reviewReason: string;
      calibrationReason: string;
    };
    hallucinationRisk: string;
    disclaimer: string;
  };
}

export interface MessageAttachment {
  type: 'prescription' | 'image' | 'document';
  url: string;
  name: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  type: 'general' | 'prescription' | 'comparison' | 'interaction_check';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'pharmacist' | 'doctor' | 'admin';
  profileImage?: string;
  phoneNumber?: string;
  address?: Address;
  medicalHistory?: MedicalCondition[];
  currentMedications?: CurrentMedication[];
  allergies?: string[];
  emergencyContact?: EmergencyContact;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface MedicalCondition {
  condition: string;
  diagnosedDate: Date;
  severity: 'mild' | 'moderate' | 'severe';
  status: 'active' | 'resolved' | 'managed';
}

export interface CurrentMedication {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  prescribedBy: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumber: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: Address;
  phoneNumber: string;
  email: string;
  licenseNumber: string;
  operatingHours: OperatingHours;
  services: PharmacyService[];
  inventory: Medicine[];
  rating: number;
  verified: boolean;
}

export interface OperatingHours {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface PharmacyService {
  name: string;
  description: string;
  available: boolean;
}

export interface ComparisonResult {
  medicines: Medicine[];
  criteria: ComparisonCriteria;
  results: ComparisonMetric[];
}

export interface ComparisonCriteria {
  price: boolean;
  effectiveness: boolean;
  sideEffects: boolean;
  availability: boolean;
  alternatives: boolean;
}

export interface ComparisonMetric {
  medicineId: string;
  scores: {
    price: number;
    effectiveness: number;
    sideEffects: number;
    availability: number;
    overall: number;
  };
  pros: string[];
  cons: string[];
  recommendation: string;
}

export interface InteractionCheck {
  medicines: string[];
  interactions: DrugInteraction[];
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  recommendations: string[];
  alternatives?: string[];
}

export interface AuthenticityCheck {
  medicineId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  status: 'authentic' | 'suspicious' | 'counterfeit' | 'expired';
  verificationSource: 'cdsco' | 'fda' | 'manufacturer';
  confidence: number;
  warnings?: string[];
}

export type QuestionType = 
  | 'alternatives'
  | 'dosage'
  | 'usage'
  | 'sideEffects'
  | 'expiryDate'
  | 'interactions'
  | 'authenticity'
  | 'comparison'
  | 'availability';

export interface QuestionTemplate {
  id: QuestionType;
  text: string;
  responseTemplate: (medicine: Medicine) => string;
  category: 'basic' | 'advanced' | 'regulatory';
}

export interface AnalyticsData {
  totalMedicines: number;
  totalUsers: number;
  totalPharmacies: number;
  authenticityChecks: number;
  interactionAlerts: number;
  prescriptionAnalyses: number;
  popularMedicines: Medicine[];
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: Date;
  category: 'search' | 'comparison' | 'interaction' | 'authenticity' | 'prescription';
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  interactionAlerts: boolean;
  expiryReminders: boolean;
  priceAlerts: boolean;
  stockAlerts: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  currency: string;
  units: 'metric' | 'imperial';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export interface PrivacySettings {
  shareDataWithPharmacies: boolean;
  allowAnalytics: boolean;
  showInDirectory: boolean;
  dataRetention: '1year' | '2years' | '5years' | 'indefinite';
}