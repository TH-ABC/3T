import { GoogleGenAI } from "@google/genai";
import { DashboardMetrics, DailyStat } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const geminiService = {
  analyzeBusiness: async (metrics: DashboardMetrics, chartData: DailyStat[]) => {
    const ai = getClient();
    if (!ai) return "Vui lòng cấu hình API KEY để sử dụng AI studio.";

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
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Hệ thống AI đang bận, vui lòng thử lại sau.";
    }
  }
};
