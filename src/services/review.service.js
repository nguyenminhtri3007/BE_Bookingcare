import db from "../models";
import { Op } from "sequelize";

export const createReview = async (historyId, userId, rating, comment) => {
  // Kiểm tra lịch sử khám có tồn tại và thuộc về bệnh nhân không
  const history = await db.History.findOne({ where: { id: historyId, patientId: userId } });
  if (!history) return { error: "Không tìm thấy lịch sử khám hoặc bạn không có quyền đánh giá." };

  // Kiểm tra đã có review chưa
  const existed = await db.Review.findOne({ where: { historyId } });
  if (existed) return { error: "Lịch sử khám này đã được đánh giá." };

  // Tạo review với doctorId từ history
  const review = await db.Review.create({ 
    historyId, 
    patientId: userId, 
    doctorId: history.doctorId,
    rating, 
    comment 
  });
  return { data: review };
};

export const getDoctorReviews = async (doctorId) => {

  const reviews = await db.Review.findAll({
    where: { doctorId },
    include: [
      {
        model: db.History,
        as: "historyReviewData",
        attributes: ["id", "description", "createdAt"]
      },
      {
        model: db.User,
        as: "patientReviewData",
        attributes: ["id", "firstName", "lastName",]
      }
    ],
    raw: false, 
    
    order: [["createdAt", "DESC"]]
  });
  return { data: reviews };
  
};

export const getReviewById = async (id) => {
  const review = await db.Review.findOne({
    where: { id },
    include: [
      {
        model: db.History,
        as: "historyData",
        attributes: ["id", "description", "createdAt"]
      },
      {
        model: db.User,
        as: "patientData",
        attributes: ["id", "firstName", "lastName", "image"]
      }
    ]
  });
  if (!review) return { error: "Không tìm thấy đánh giá." };
  return { data: review };
};

export const updateReview = async (id, userId, rating, comment) => {
  const review = await db.Review.findOne({ where: { id, patientId: userId } });
  if (!review) return { error: "Không tìm thấy hoặc không có quyền cập nhật đánh giá." };
  await review.update({ rating: rating || review.rating, comment: comment || review.comment });
  return { data: review };
};

export const deleteReview = async (id, userId) => {
  const review = await db.Review.findOne({ where: { id, patientId: userId } });
  if (!review) return { error: "Không tìm thấy hoặc không có quyền xóa đánh giá." };
  await review.destroy();
  return { message: "Xóa đánh giá thành công." };
}; 

export const getReviewedHistoriesByPatient = async (patientId, historyIds) => {
  if (!patientId || !Array.isArray(historyIds) || historyIds.length === 0) {
    return { error: "Invalid input: patientId and historyIds array are required.", data: [] };
  }
  try {
    const reviews = await db.Review.findAll({
      where: {
        patientId: patientId,
        historyId: {
          [Op.in]: historyIds,
        },
      },
      attributes: ["historyId"], 
      raw: false, 
    });
    const reviewedIds = reviews.map(review => review.historyId);
    return { data: reviewedIds };
  } catch (e) {
    console.error("Error in getReviewedHistoriesByPatient service:", e);
    return { error: "Server error while fetching reviewed histories.", data: [] };
  }
}; 

export const getDoctorReviewStats = async (doctorId) => {
  try {
    const reviews = await db.Review.findAll({
      where: { doctorId },
      attributes: ["rating"],
      raw: true,
    });

    if (!reviews || reviews.length === 0) {
      return {
        data: {
          totalReviews: 0,
          averageRating: 0,
        }
      };
    }

    const totalReviews = reviews.length;
    const sumOfRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalReviews > 0 ? sumOfRatings / totalReviews : 0;

    return {
      data: {
        totalReviews,
        averageRating: parseFloat(averageRating.toFixed(1)),
      }
    };
  } catch (e) {
    console.error("Error in getDoctorReviewStats service:", e);
    return { error: "Server error while fetching doctor review stats." };
  }
}; 