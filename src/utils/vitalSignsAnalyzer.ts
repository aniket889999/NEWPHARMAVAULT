// Vital Signs Analysis System for PharmaVault
export interface VitalSigns {
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  bloodSugar?: number;
}

export interface VitalSignsAnalysis {
  overall: 'normal' | 'concerning' | 'abnormal';
  heartRate: VitalSignAssessment;
  bloodPressure: VitalSignAssessment;
  temperature: VitalSignAssessment;
  oxygenSaturation: VitalSignAssessment;
  respiratoryRate: VitalSignAssessment;
  bloodSugar: VitalSignAssessment;
  recommendations: string[];
  urgentCare: boolean;
}

interface VitalSignAssessment {
  status: 'normal' | 'low' | 'high' | 'concerning' | 'not_provided';
  value?: number;
  normalRange: string;
  interpretation: string;
}

// Normal ranges for vital signs (adult values)
const NORMAL_RANGES = {
  heartRate: { min: 60, max: 100, unit: 'bpm' },
  systolicBP: { min: 90, max: 120, unit: 'mmHg' },
  diastolicBP: { min: 60, max: 80, unit: 'mmHg' },
  temperature: { 
    fahrenheit: { min: 97.8, max: 99.1, unit: '°F' },
    celsius: { min: 36.5, max: 37.3, unit: '°C' }
  },
  oxygenSaturation: { min: 95, max: 100, unit: '%' },
  respiratoryRate: { min: 12, max: 20, unit: 'breaths/min' },
  bloodSugar: {
    fasting: { min: 70, max: 100, unit: 'mg/dL' },
    random: { min: 70, max: 140, unit: 'mg/dL' }
  }
};

export const parseVitalSigns = (input: string): VitalSigns => {
  const vitals: VitalSigns = {};
  const text = input.toLowerCase();

  // Heart rate patterns
  const heartRateMatch = text.match(/(?:heart rate|hr|pulse)[\s:]*(\d+)(?:\s*bpm)?/i);
  if (heartRateMatch) {
    vitals.heartRate = parseInt(heartRateMatch[1]);
  }

  // Blood pressure patterns
  const bpMatch = text.match(/(?:blood pressure|bp)[\s:]*(\d+)\/(\d+)(?:\s*mmhg)?/i);
  if (bpMatch) {
    vitals.systolicBP = parseInt(bpMatch[1]);
    vitals.diastolicBP = parseInt(bpMatch[2]);
  }

  // Temperature patterns (both F and C)
  const tempFMatch = text.match(/(?:temperature|temp)[\s:]*(\d+(?:\.\d+)?)(?:\s*°?f)/i);
  const tempCMatch = text.match(/(?:temperature|temp)[\s:]*(\d+(?:\.\d+)?)(?:\s*°?c)/i);
  
  if (tempFMatch) {
    vitals.temperature = parseFloat(tempFMatch[1]);
  } else if (tempCMatch) {
    // Convert Celsius to Fahrenheit for consistency
    vitals.temperature = (parseFloat(tempCMatch[1]) * 9/5) + 32;
  }

  // Oxygen saturation patterns
  const o2Match = text.match(/(?:oxygen saturation|o2 sat|spo2)[\s:]*(\d+)(?:\s*%)?/i);
  if (o2Match) {
    vitals.oxygenSaturation = parseInt(o2Match[1]);
  }

  // Respiratory rate patterns
  const respMatch = text.match(/(?:respiratory rate|breathing rate|resp rate)[\s:]*(\d+)/i);
  if (respMatch) {
    vitals.respiratoryRate = parseInt(respMatch[1]);
  }

  // Blood sugar patterns
  const bsMatch = text.match(/(?:blood sugar|glucose|bg)[\s:]*(\d+)(?:\s*mg\/dl)?/i);
  if (bsMatch) {
    vitals.bloodSugar = parseInt(bsMatch[1]);
  }

  return vitals;
};

export const analyzeVitalSigns = (vitals: VitalSigns): VitalSignsAnalysis => {
  const analysis: VitalSignsAnalysis = {
    overall: 'normal',
    heartRate: analyzeHeartRate(vitals.heartRate),
    bloodPressure: analyzeBloodPressure(vitals.systolicBP, vitals.diastolicBP),
    temperature: analyzeTemperature(vitals.temperature),
    oxygenSaturation: analyzeOxygenSaturation(vitals.oxygenSaturation),
    respiratoryRate: analyzeRespiratoryRate(vitals.respiratoryRate),
    bloodSugar: analyzeBloodSugar(vitals.bloodSugar),
    recommendations: [],
    urgentCare: false
  };

  // Determine overall status and recommendations
  const assessments = [
    analysis.heartRate,
    analysis.bloodPressure,
    analysis.temperature,
    analysis.oxygenSaturation,
    analysis.respiratoryRate,
    analysis.bloodSugar
  ];

  const concerningCount = assessments.filter(a => a.status === 'concerning').length;
  const abnormalCount = assessments.filter(a => a.status === 'high' || a.status === 'low').length;

  if (concerningCount > 0) {
    analysis.overall = 'concerning';
    analysis.urgentCare = true;
  } else if (abnormalCount > 1) {
    analysis.overall = 'abnormal';
  }

  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis);

  return analysis;
};

const analyzeHeartRate = (hr?: number): VitalSignAssessment => {
  if (!hr) {
    return {
      status: 'not_provided',
      normalRange: '60-100 bpm',
      interpretation: 'Heart rate not provided'
    };
  }

  const { min, max } = NORMAL_RANGES.heartRate;
  
  if (hr < 50) {
    return {
      status: 'concerning',
      value: hr,
      normalRange: '60-100 bpm',
      interpretation: 'Significantly low heart rate (bradycardia) - may indicate heart problems'
    };
  } else if (hr < min) {
    return {
      status: 'low',
      value: hr,
      normalRange: '60-100 bpm',
      interpretation: 'Below normal range - could be due to fitness, medications, or heart conditions'
    };
  } else if (hr > 120) {
    return {
      status: 'concerning',
      value: hr,
      normalRange: '60-100 bpm',
      interpretation: 'Significantly elevated heart rate (tachycardia) - may indicate stress, fever, or heart issues'
    };
  } else if (hr > max) {
    return {
      status: 'high',
      value: hr,
      normalRange: '60-100 bpm',
      interpretation: 'Above normal range - could be due to activity, stress, caffeine, or anxiety'
    };
  }

  return {
    status: 'normal',
    value: hr,
    normalRange: '60-100 bpm',
    interpretation: 'Within normal range'
  };
};

const analyzeBloodPressure = (systolic?: number, diastolic?: number): VitalSignAssessment => {
  if (!systolic || !diastolic) {
    return {
      status: 'not_provided',
      normalRange: '90-120/60-80 mmHg',
      interpretation: 'Blood pressure not provided'
    };
  }

  if (systolic >= 180 || diastolic >= 110) {
    return {
      status: 'concerning',
      value: systolic,
      normalRange: '90-120/60-80 mmHg',
      interpretation: 'Hypertensive crisis - requires immediate medical attention'
    };
  } else if (systolic < 90 || diastolic < 60) {
    return {
      status: 'low',
      value: systolic,
      normalRange: '90-120/60-80 mmHg',
      interpretation: 'Low blood pressure (hypotension) - may cause dizziness or fainting'
    };
  } else if (systolic >= 140 || diastolic >= 90) {
    return {
      status: 'high',
      value: systolic,
      normalRange: '90-120/60-80 mmHg',
      interpretation: 'High blood pressure (hypertension) - should be monitored and managed'
    };
  } else if (systolic >= 130 || diastolic >= 80) {
    return {
      status: 'high',
      value: systolic,
      normalRange: '90-120/60-80 mmHg',
      interpretation: 'Elevated blood pressure - lifestyle changes may be beneficial'
    };
  }

  return {
    status: 'normal',
    value: systolic,
    normalRange: '90-120/60-80 mmHg',
    interpretation: 'Within normal range'
  };
};

const analyzeTemperature = (temp?: number): VitalSignAssessment => {
  if (!temp) {
    return {
      status: 'not_provided',
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'Temperature not provided'
    };
  }

  const { min, max } = NORMAL_RANGES.temperature.fahrenheit;

  if (temp >= 103) {
    return {
      status: 'concerning',
      value: temp,
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'High fever - requires immediate medical attention'
    };
  } else if (temp >= 100.4) {
    return {
      status: 'high',
      value: temp,
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'Fever present - body is fighting infection or illness'
    };
  } else if (temp > max) {
    return {
      status: 'high',
      value: temp,
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'Slightly elevated - may indicate early illness or activity'
    };
  } else if (temp < 95) {
    return {
      status: 'concerning',
      value: temp,
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'Hypothermia - dangerously low body temperature'
    };
  } else if (temp < min) {
    return {
      status: 'low',
      value: temp,
      normalRange: '97.8-99.1°F (36.5-37.3°C)',
      interpretation: 'Below normal - may indicate poor circulation or environmental factors'
    };
  }

  return {
    status: 'normal',
    value: temp,
    normalRange: '97.8-99.1°F (36.5-37.3°C)',
    interpretation: 'Within normal range'
  };
};

const analyzeOxygenSaturation = (o2?: number): VitalSignAssessment => {
  if (!o2) {
    return {
      status: 'not_provided',
      normalRange: '95-100%',
      interpretation: 'Oxygen saturation not provided'
    };
  }

  if (o2 < 90) {
    return {
      status: 'concerning',
      value: o2,
      normalRange: '95-100%',
      interpretation: 'Severely low oxygen levels - requires immediate medical attention'
    };
  } else if (o2 < 95) {
    return {
      status: 'low',
      value: o2,
      normalRange: '95-100%',
      interpretation: 'Below normal - may indicate respiratory or circulation problems'
    };
  }

  return {
    status: 'normal',
    value: o2,
    normalRange: '95-100%',
    interpretation: 'Within normal range'
  };
};

const analyzeRespiratoryRate = (rr?: number): VitalSignAssessment => {
  if (!rr) {
    return {
      status: 'not_provided',
      normalRange: '12-20 breaths/min',
      interpretation: 'Respiratory rate not provided'
    };
  }

  const { min, max } = NORMAL_RANGES.respiratoryRate;

  if (rr < 8 || rr > 30) {
    return {
      status: 'concerning',
      value: rr,
      normalRange: '12-20 breaths/min',
      interpretation: 'Abnormal breathing rate - requires medical evaluation'
    };
  } else if (rr < min) {
    return {
      status: 'low',
      value: rr,
      normalRange: '12-20 breaths/min',
      interpretation: 'Below normal - may indicate respiratory depression'
    };
  } else if (rr > max) {
    return {
      status: 'high',
      value: rr,
      normalRange: '12-20 breaths/min',
      interpretation: 'Above normal - may indicate respiratory distress or anxiety'
    };
  }

  return {
    status: 'normal',
    value: rr,
    normalRange: '12-20 breaths/min',
    interpretation: 'Within normal range'
  };
};

const analyzeBloodSugar = (bs?: number): VitalSignAssessment => {
  if (!bs) {
    return {
      status: 'not_provided',
      normalRange: '70-140 mg/dL (varies by timing)',
      interpretation: 'Blood sugar not provided'
    };
  }

  if (bs < 54) {
    return {
      status: 'concerning',
      value: bs,
      normalRange: '70-140 mg/dL (varies by timing)',
      interpretation: 'Severely low blood sugar (hypoglycemia) - requires immediate treatment'
    };
  } else if (bs < 70) {
    return {
      status: 'low',
      value: bs,
      normalRange: '70-140 mg/dL (varies by timing)',
      interpretation: 'Low blood sugar - may cause symptoms like shakiness or dizziness'
    };
  } else if (bs > 250) {
    return {
      status: 'concerning',
      value: bs,
      normalRange: '70-140 mg/dL (varies by timing)',
      interpretation: 'Very high blood sugar - requires medical attention'
    };
  } else if (bs > 180) {
    return {
      status: 'high',
      value: bs,
      normalRange: '70-140 mg/dL (varies by timing)',
      interpretation: 'Elevated blood sugar - may indicate diabetes or recent meal'
    };
  }

  return {
    status: 'normal',
    value: bs,
    normalRange: '70-140 mg/dL (varies by timing)',
    interpretation: 'Within acceptable range'
  };
};

const generateRecommendations = (analysis: VitalSignsAnalysis): string[] => {
  const recommendations: string[] = [];

  // Heart rate recommendations
  if (analysis.heartRate.status === 'high') {
    recommendations.push('Try relaxation techniques, avoid caffeine, and rest');
  } else if (analysis.heartRate.status === 'low') {
    recommendations.push('Monitor for symptoms like dizziness or fatigue');
  }

  // Blood pressure recommendations
  if (analysis.bloodPressure.status === 'high') {
    recommendations.push('Reduce sodium intake, exercise regularly, and manage stress');
  } else if (analysis.bloodPressure.status === 'low') {
    recommendations.push('Stay hydrated, avoid sudden position changes, and eat regular meals');
  }

  // Temperature recommendations
  if (analysis.temperature.status === 'high') {
    recommendations.push('Stay hydrated, rest, and consider fever-reducing medication');
  } else if (analysis.temperature.status === 'low') {
    recommendations.push('Keep warm and monitor for other symptoms');
  }

  // Oxygen saturation recommendations
  if (analysis.oxygenSaturation.status === 'low') {
    recommendations.push('Ensure good posture, practice deep breathing, and avoid smoke');
  }

  // General recommendations
  if (analysis.overall !== 'normal') {
    recommendations.push('Monitor your vital signs regularly');
    recommendations.push('Keep a record of your readings to share with healthcare providers');
  }

  if (analysis.urgentCare) {
    recommendations.unshift('Seek immediate medical attention');
  }

  return recommendations;
};

export const generateVitalSignsResponse = (input: string): string => {
  const vitals = parseVitalSigns(input);
  const analysis = analyzeVitalSigns(vitals);

  // Check if any vital signs were detected
  const hasVitals = Object.values(vitals).some(v => v !== undefined);
  
  if (!hasVitals) {
    return `I didn't detect any vital signs in your message. Please provide your vital signs in this format:

**Example:**
Heart rate: 75 bpm
Blood pressure: 120/80 mmHg
Temperature: 98.6°F
Oxygen saturation: 98%

**Supported vital signs:**
• Heart rate (bpm)
• Blood pressure (systolic/diastolic mmHg)
• Temperature (°F or °C)
• Oxygen saturation (%)
• Respiratory rate (breaths/min)
• Blood sugar (mg/dL)

Remember, this is general information only. If you feel unwell or your symptoms continue, please consult a healthcare professional.`;
  }

  let response = `**Your Vital Signs Analysis:**\n\n`;

  // Add individual assessments
  const assessments = [
    { name: 'Heart Rate', data: analysis.heartRate, unit: 'bpm' },
    { name: 'Blood Pressure', data: analysis.bloodPressure, unit: 'mmHg' },
    { name: 'Temperature', data: analysis.temperature, unit: '°F' },
    { name: 'Oxygen Saturation', data: analysis.oxygenSaturation, unit: '%' },
    { name: 'Respiratory Rate', data: analysis.respiratoryRate, unit: 'breaths/min' },
    { name: 'Blood Sugar', data: analysis.bloodSugar, unit: 'mg/dL' }
  ];

  assessments.forEach(({ name, data, unit }) => {
    if (data.status !== 'not_provided') {
      const statusEmoji = {
        'normal': '✅',
        'low': '⬇️',
        'high': '⬆️',
        'concerning': '🚨'
      }[data.status] || '';

      response += `**${name}:** ${data.value} ${unit} ${statusEmoji}\n`;
      response += `• Normal range: ${data.normalRange}\n`;
      response += `• ${data.interpretation}\n\n`;
    }
  });

  // Overall assessment
  const overallEmoji = {
    'normal': '✅',
    'abnormal': '⚠️',
    'concerning': '🚨'
  }[analysis.overall];

  response += `**Overall Assessment:** ${analysis.overall.toUpperCase()} ${overallEmoji}\n\n`;

  // Recommendations
  if (analysis.recommendations.length > 0) {
    response += `**Recommendations:**\n`;
    analysis.recommendations.forEach(rec => {
      response += `• ${rec}\n`;
    });
    response += '\n';
  }

  // Urgent care warning
  if (analysis.urgentCare) {
    response += `🚨 **IMPORTANT:** Some of your vital signs are concerning and may require immediate medical attention. Please contact a healthcare provider or emergency services if you feel unwell.\n\n`;
  }

  response += `Remember, this is general information only. If you feel unwell or your symptoms continue, please consult a healthcare professional.`;

  return response;
};