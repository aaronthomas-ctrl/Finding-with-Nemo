import type { Enquiry } from '../db';

export interface Prediction {
  productLine: string;
  department: string | null;
  predictedNextDate: Date;
  confidence: "High" | "Medium" | "Low";
  n: number;
  avgInterval: number;
  lastEnquiryDate: Date;
}

export function computePredictions(enquiries: Enquiry[]): Prediction[] {
  const groups: Record<string, Enquiry[]> = {};

  for (const enq of enquiries) {
    // Group by productLine
    const pKey = `P:${enq.productLine}`;
    if (!groups[pKey]) groups[pKey] = [];
    groups[pKey].push(enq);

    // Group by productLine + department
    if (enq.department && enq.department.trim() !== '') {
      const dKey = `D:${enq.productLine}|${enq.department.trim()}`;
      if (!groups[dKey]) groups[dKey] = [];
      groups[dKey].push(enq);
    }
  }

  const predictions: Prediction[] = [];

  for (const [key, group] of Object.entries(groups)) {
    if (group.length >= 2) {
      // Sort by date ascending
      const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const diffTime = sorted[i].date.getTime() - sorted[i-1].date.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        intervals.push(diffDays);
      }

      const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      
      let variance = 0;
      for (const val of intervals) {
        variance += Math.pow(val - mean, 2);
      }
      variance = variance / intervals.length;
      const stdev = Math.sqrt(variance);

      let confidence: "High" | "Medium" | "Low" = "Low";
      if (intervals.length === 1) { // 2 enquiries = 1 interval
        confidence = "Low";
      } else {
        const cv = mean > 0 ? stdev / mean : 0;
        if (cv < 0.25) confidence = "High";
        else if (cv <= 0.5) confidence = "Medium";
        else confidence = "Low";
      }

      const lastDate = sorted[sorted.length - 1].date;
      const predictedNextDate = new Date(lastDate.getTime() + mean * 24 * 3600 * 1000);

      const isDept = key.startsWith('D:');
      const parts = key.substring(2).split('|');
      const productLine = parts[0];
      const department = isDept ? parts[1] : null;

      predictions.push({
        productLine,
        department,
        predictedNextDate,
        confidence,
        n: sorted.length,
        avgInterval: Math.round(mean),
        lastEnquiryDate: lastDate
      });
    }
  }

  // Filter out productLine predictions if there's a department prediction for the same productLine?
  // "Where both a productLine-level and a department-level prediction exist, prefer the department-level one (tighter pattern) but show both."
  // It says "prefer... but show both". We will just sort them to show dept ones first, or whatever.

  return predictions.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());
}
