"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatHistory extends Model {
    static associate(models) {
      ChatHistory.belongsTo(models.User, {
        foreignKey: "userId",
        targetKey: "id",
        as: "userData",
      });
    }
  }
  ChatHistory.init(
    {
      userId: DataTypes.INTEGER,
      sessionId: DataTypes.STRING, // Để nhóm các tin nhắn trong cùng 1 phiên chat
      message: DataTypes.TEXT, // Nội dung tin nhắn từ user
      response: DataTypes.TEXT, // Phản hồi từ chatbot
      messageType: DataTypes.STRING, // Loại tin nhắn (doctor, specialty, clinic, general)
    },
    {
      sequelize,
      modelName: "ChatHistory",
    }
  );
  return ChatHistory;
}; 