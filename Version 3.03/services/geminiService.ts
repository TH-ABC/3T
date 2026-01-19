
import { GoogleGenAI } from "@google/genai";
import { DashboardMetrics, DailyStat } from '../types';

export const geminiService = {
  analyzeBusiness: async (metrics: DashboardMetrics, chartData: DailyStat[]) => {
    // FIX: Obtain the API key exclusively from process.env.API_KEY and initialize right before the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Bạn là một trợ lý phân tích dữ liệu kinh doanh chuyên nghiệp cho Team 3T.
      Dựa trên dữ liệu sau đây, hãy đưa ra nhận xét ngắn gọn (khoảng 3-4 câu) về tình hình kinh doanh, xu hướng và 1 lời khuyên thực tế.
      Trả lời bằng tiếng Việt, giọng văn chuyên nghiệp, tích cực và quyết đoán.

      Dữ liệu tổng quan:
      - Doanh thu tổng: ${metrics.revenue.toLocaleString('vi-VN')} đ
      - Lợi nhuận ròng: ${metrics.netIncome.toLocaleString('vi-VN')} đ
      - Tổng công nợ: ${metrics.debt.toLocaleString('vi-VN')} đ
      
      Dữ liệu biểu đồ 5 ngày gần nhất:
      ${JSON.stringify(chartData.slice(-5))}
    `;

    try {
      const response = await ai.models.generateContent({
        // FIX: Using gemini-3-pro-preview for complex reasoning and business analysis
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      // Accessing response.text directly as a property as per GenAI SDK guidelines
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Hệ thống AI đang bận, vui lòng thử lại sau.";
    }
  }
};
