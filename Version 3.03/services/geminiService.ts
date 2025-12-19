import { GoogleGenAI } from "@google/genai";
// Fixed: Changed missing member DailyRevenue to DailyStat as per types.ts.
import { DashboardMetrics, DailyStat } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    // Named parameter initialization for the GoogleGenAI instance.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const geminiService = {
  // Fixed: Updated parameter type to use DailyStat instead of non-existent DailyRevenue.
  analyzeBusiness: async (metrics: DashboardMetrics, chartData: DailyStat[]) => {
    const ai = getClient();
    if (!ai) return "Vui lòng cấu hình API KEY để sử dụng AI.";

    const prompt = `
      Bạn là một trợ lý phân tích dữ liệu kinh doanh chuyên nghiệp.
      Dựa trên dữ liệu sau đây, hãy đưa ra nhận xét ngắn gọn (khoảng 3-4 câu) về tình hình kinh doanh, xu hướng và 1 lời khuyên.
      Trả lời bằng tiếng Việt, giọng văn chuyên nghiệp, tích cực.

      Dữ liệu tổng quan:
      - Doanh thu: ${metrics.revenue.toLocaleString('vi-VN')} đ
      - Lợi nhuận ròng: ${metrics.netIncome.toLocaleString('vi-VN')} đ
      - Công nợ khách hàng: ${metrics.debt.toLocaleString('vi-VN')} đ
      
      Dữ liệu biểu đồ (gần đây):
      ${JSON.stringify(chartData.slice(-5))}
    `;

    try {
      // Fixed: Direct call to ai.models.generateContent with model name and contents.
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      // Fixed: Access the .text property directly (not a method).
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Không thể phân tích dữ liệu lúc này.";
    }
  }
};