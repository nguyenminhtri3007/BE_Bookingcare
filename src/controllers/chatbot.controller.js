import * as ChatbotService from '../services/chatbot.service';

export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, userId, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        errCode: 1,
        errMessage: "Thiếu thông tin tin nhắn",
        data: null,
      });
    }

    // Xử lý tin nhắn từ người dùng và lưu lịch sử
    const result = await ChatbotService.processUserQuery(message, userId, sessionId);

    if (result.error) {
      return res.status(500).json({
        errCode: 2,
        errMessage: result.error,
        data: null,
      });
    }

    return res.status(200).json({
      errCode: 0,
      errMessage: "OK",
      data: result.response,
      sessionId: result.sessionId
    });
  } catch (e) {
    console.error('Error handling chatbot message:', e);
    return res.status(500).json({
      errCode: 3,
      errMessage: "Lỗi từ server",
      data: null,
    });
  }
};

export const getChatHistoryBySessionId = async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({
        errCode: 1,
        errMessage: "Thiếu thông tin sessionId",
        data: null,
      });
    }

    const result = await ChatbotService.getChatHistoryBySessionId(sessionId);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Error getting chat history:', e);
    return res.status(500).json({
      errCode: 3,
      errMessage: "Lỗi từ server",
      data: null,
    });
  }
};

export const getChatHistoryByUserId = async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        errCode: 1,
        errMessage: "Thiếu thông tin userId",
        data: null,
      });
    }

    const result = await ChatbotService.getChatHistoryByUserId(userId);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Error getting user chat history:', e);
    return res.status(500).json({
      errCode: 3,
      errMessage: "Lỗi từ server",
      data: null,
    });
  }
};


export const deleteChatHistory = async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        errCode: 1,
        errMessage: "Thiếu thông tin sessionId",
        data: null,
      });
    }

    const result = await ChatbotService.deleteChatHistory(sessionId, userId);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Error deleting chat history:', e);
    return res.status(500).json({
      errCode: 3,
      errMessage: "Lỗi từ server",
      data: null,
    });
  }
};