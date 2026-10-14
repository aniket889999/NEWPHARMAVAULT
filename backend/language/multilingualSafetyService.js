class MultilingualSafetyService {
  checkEmergency(text) {
    const t = text.toLowerCase();
    
    // Hindi Emergencies
    if (t.includes('सीने में दर्द') || t.includes('सांस लेने में तकलीफ') || t.includes('सांस फूल') || t.includes('बेहोश')) {
      return { isEmergency: true, language: 'hi', response: "🚨 मेडिकल इमरजेंसी! कृपया तुरंत 112/108 डायल करें या नजदीकी अस्पताल जाएं।" };
    }
    
    // Marathi Emergencies
    if (t.includes('छातीत दुखतंय') || t.includes('श्वास घ्यायला त्रास') || t.includes('चक्कर') || t.includes('बेशुद्ध')) {
      return { isEmergency: true, language: 'mr', response: "🚨 वैद्यकीय आणीबाणी! कृपया त्वरित 112/108 डायल करा किंवा जवळच्या रुग्णालयात जा." };
    }

    // Hinglish / English Emergencies
    if (/(chest pain|breathing|overdose|unconscious|seizure|suicide)/i.test(t)) {
      return { isEmergency: true, language: 'en', response: "🚨 MEDICAL EMERGENCY DETECTED! Please contact emergency services (112/911) immediately or visit the nearest hospital." };
    }

    return { isEmergency: false };
  }
}

module.exports = new MultilingualSafetyService();
