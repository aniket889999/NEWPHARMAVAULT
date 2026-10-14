const patientTimelineService = require('../intelligence/patient/patientTimelineService');
const adherenceService = require('../intelligence/patient/adherenceService');
const refillPredictionService = require('../intelligence/patient/refillPredictionService');
const insightEngine = require('../intelligence/patient/insightEngine');

class PatientIntelligenceAgent {
  async evaluate(context) {
    console.log(`[Patient Intelligence Agent] Processing intent: ${context.intent}`);
    const userId = "mock_user"; // In production, pass from context.user._id

    let evidence = {
      adherenceScore: null,
      refillRisks: [],
      recentTimeline: [],
      insights: []
    };

    let intelligenceStr = "";

    try {
      if (context.intent === 'patient_adherence' || context.intent === 'patient_insights') {
        const adherence = await adherenceService.calculateScore(userId);
        evidence.adherenceScore = adherence;
        intelligenceStr += `Adherence Score: ${adherence.currentScore}/100. Trend: ${adherence.trend}. `;
        
        const insights = await insightEngine.generateInsights(
          adherence, 
          await refillPredictionService.getRefillRisks(userId), 
          []
        );
        evidence.insights = insights.insights;
        if (evidence.insights.length > 0) {
          intelligenceStr += `Insights: ${evidence.insights.join(' ')} `;
        }
      }

      if (context.intent === 'refill_risk' || context.intent === 'active_medicines' || context.intent === 'patient_insights') {
        const refills = await refillPredictionService.getRefillRisks(userId);
        evidence.refillRisks = refills;
        const critical = refills.filter(r => r.riskLevel === 'High');
        if (critical.length > 0) {
          intelligenceStr += `High Refill Risk: ${critical.map(c => c.medicine).join(', ')}. `;
        }
        if (context.intent === 'active_medicines') {
          intelligenceStr += `Active Medicines: ${refills.map(r => r.medicine).join(', ')}. `;
        }
      }

      if (context.intent === 'medicine_timeline' || context.intent === 'patient_insights') {
        const timeline = await patientTimelineService.getTimeline(userId);
        evidence.recentTimeline = timeline.slice(0, 3); // top 3 recent
        intelligenceStr += `Recent Events: ${evidence.recentTimeline.map(t => `${t.type.replace('_', ' ')} (${t.medicine})`).join(', ')}. `;
      }

    } catch (error) {
      console.error("[Patient Intelligence Agent] Error:", error);
    }

    return {
      evidenceObj: evidence,
      evidenceString: intelligenceStr.trim(),
      hasEvidence: intelligenceStr.length > 0
    };
  }
}

module.exports = new PatientIntelligenceAgent();
