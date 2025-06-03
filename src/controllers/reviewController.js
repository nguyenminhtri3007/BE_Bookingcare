import * as ReviewService from '../services/review.service';

export const createReview = async (req, res) => {
  try {
    const { historyId, rating, comment, userId } = req.body;
    const result = await ReviewService.createReview(historyId, userId, rating, comment);
    if (result.error) {
      return res.status(400).json({ errCode: 1, errMessage: result.error, data: null });
    }
    return res.status(201).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
};

export const getDoctorReviews = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.params.doctorId;
    if (!doctorId) {
      return res.status(400).json({ errCode: 1, errMessage: "DoctorId is required", data: null });
    }
    const doctorIdNumber = parseInt(doctorId, 10);
    if (isNaN(doctorIdNumber)) {
      return res.status(400).json({ errCode: 1, errMessage: "DoctorId must be a number", data: null });
    }
    const result = await ReviewService.getDoctorReviews(doctorIdNumber);
    return res.status(200).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    console.error("Error in getDoctorReviews controller:", e);
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ReviewService.getReviewById(id);
    if (result.error) {
      return res.status(404).json({ errCode: 1, errMessage: result.error, data: null });
    }
    return res.status(200).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
};

export const updateReview = async (req, res) => {
  try {
    const id = req.params.id;
    const { rating, comment, userId } = req.body;
    const result = await ReviewService.updateReview(id, userId, rating, comment);
    if (result.error) {
      return res.status(404).json({ errCode: 1, errMessage: result.error, data: null });
    }
    return res.status(200).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.body.userId || req.query.userId;
    const result = await ReviewService.deleteReview(id, userId);
    if (result.error) {
      return res.status(404).json({ errCode: 1, errMessage: result.error, data: null });
    }
    return res.status(200).json({ errCode: 0, errMessage: result.message, data: null });
  } catch (e) {
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
}; 

export const getReviewedHistoriesByPatient = async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId, 10);
    const historyIdsString = req.query.historyIds; 

    if (!patientId || !historyIdsString) {
      return res.status(400).json({ errCode: 1, errMessage: "patientId and historyIds are required", data: null });
    }

    const historyIds = historyIdsString.split(',').map(id => parseInt(id.trim(), 10));

    if (historyIds.some(isNaN)) {
      return res.status(400).json({ errCode: 1, errMessage: "All historyIds must be numbers", data: null });
    }

    const result = await ReviewService.getReviewedHistoriesByPatient(patientId, historyIds);

    if (result.error) {
      return res.status(400).json({ errCode: 1, errMessage: result.error, data: null });
    }
    return res.status(200).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    console.error("Error in getReviewedHistoriesByPatient controller:", e);
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
}; 

export const getDoctorReviewStats = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.params.doctorId;
    if (!doctorId) {
      return res.status(400).json({ errCode: 1, errMessage: "DoctorId is required", data: null });
    }
    const doctorIdNumber = parseInt(doctorId, 10);
    if (isNaN(doctorIdNumber)) {
      return res.status(400).json({ errCode: 1, errMessage: "DoctorId must be a number", data: null });
    }
    const result = await ReviewService.getDoctorReviewStats(doctorIdNumber);
    if (result.error) {
      return res.status(500).json({ errCode: 2, errMessage: result.error, data: null });
    }
    return res.status(200).json({ errCode: 0, errMessage: "OK", data: result.data });
  } catch (e) {
    console.error("Error in getDoctorReviewStats controller:", e);
    return res.status(500).json({ errCode: 2, errMessage: "Lỗi server", data: null });
  }
}; 