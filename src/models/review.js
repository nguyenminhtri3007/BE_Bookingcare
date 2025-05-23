"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      // define association here
      Review.belongsTo(models.History, {
        foreignKey: "historyId",
        targetKey: "id",
        as: "historyReviewData",
      });
      Review.belongsTo(models.User, {
        foreignKey: "patientId",
        targetKey: "id",
        as: "patientReviewData",
      });
    }
  }
  Review.init(
    {
      historyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5
        }
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      modelName: "Review",
    }
  );
  return Review;
}; 