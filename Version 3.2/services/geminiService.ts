import { GoogleGenAI } from "@google/genai";
import { DashboardMetrics, DailyRevenue } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const geminiService = {
  analyzeBusiness: async (metrics: DashboardMetrics, chartData: DailyRevenue[]) => {
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Không thể phân tích dữ liệu lúc này.";
    }
  }
};
