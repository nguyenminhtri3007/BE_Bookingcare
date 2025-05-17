import db from "../models";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyCpQBr4evBkblM_xGFDcLGG_ntDj70nbzw");

// Hàm để tạo prompt tìm kiếm bác sĩ
const createDoctorSearchPrompt = async (query) => {
  try {
    // Lấy danh sách bác sĩ từ cơ sở dữ liệu
    const doctors = await db.User.findAll({
      where: { roleId: "R2" },
      attributes: {
        exclude: ["password"],
      },
      include: [
        {
          model: db.Allcode,
          as: "positionData",
          attributes: ["valueEn", "valueVi"],
        },
        {
          model: db.Doctor_Infor,
          attributes: ["specialtyId"],
          include: [
            {
              model: db.Specialty,
              as: "specialtyData",
              attributes: ["name"],
            },
          ],
        },
        {
          model: db.Markdown,
          attributes: ["description", "contentMarkdown"],
        }
      ],
      raw: false,
      nest: true,
    });

    // Chuyển đổi dữ liệu bác sĩ thành chuỗi để đưa vào prompt
    const doctorsInfo = doctors.map(doctor => {
      return {
        id: doctor.id,
        name: `${doctor.lastName} ${doctor.firstName}`,
        position: doctor.positionData ? doctor.positionData.valueVi : '',
        specialty: doctor.Doctor_Infor && doctor.Doctor_Infor.specialtyData ? doctor.Doctor_Infor.specialtyData.name : '',
        description: doctor.Markdown ? doctor.Markdown.description : '',
        content: doctor.Markdown ? doctor.Markdown.contentMarkdown : ''
      };
    });

    // Tạo prompt
    return {
      doctorsInfo: JSON.stringify(doctorsInfo),
      query: query
    };
  } catch (error) {
    console.error('Error creating doctor search prompt:', error);
    return { error: 'Không thể tìm kiếm thông tin bác sĩ.' };
  }
};

// Hàm để tạo prompt tìm kiếm chuyên khoa
const createSpecialtySearchPrompt = async (query) => {
  try {
    // Lấy danh sách chuyên khoa từ cơ sở dữ liệu
    const specialties = await db.Specialty.findAll({
      attributes: ['id', 'name', 'descriptionMarkdown', 'descriptionHTML'],
      raw: true
    });

    // Chuyển đổi dữ liệu chuyên khoa thành chuỗi để đưa vào prompt
    const specialtiesInfo = specialties.map(specialty => {
      return {
        id: specialty.id,
        name: specialty.name,
        description: specialty.descriptionMarkdown
      };
    });

    // Tạo prompt
    return {
      specialtiesInfo: JSON.stringify(specialtiesInfo),
      query: query
    };
  } catch (error) {
    console.error('Error creating specialty search prompt:', error);
    return { error: 'Không thể tìm kiếm thông tin chuyên khoa.' };
  }
};

// Hàm để tạo prompt tìm kiếm cơ sở y tế
const createClinicSearchPrompt = async (query) => {
  try {
    // Lấy danh sách cơ sở y tế từ cơ sở dữ liệu
    const clinics = await db.Clinic.findAll({
      attributes: ['id', 'name', 'address', 'descriptionMarkdown'],
      raw: true
    });

    // Chuyển đổi dữ liệu cơ sở y tế thành chuỗi để đưa vào prompt
    const clinicsInfo = clinics.map(clinic => {
      return {
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        description: clinic.descriptionMarkdown
      };
    });

    // Tạo prompt
    return {
      clinicsInfo: JSON.stringify(clinicsInfo),
      query: query
    };
  } catch (error) {
    console.error('Error creating clinic search prompt:', error);
    return { error: 'Không thể tìm kiếm thông tin cơ sở y tế.' };
  }
};

// Hàm chính để xử lý yêu cầu từ người dùng
export const processUserQuery = async (userQuery, userId, sessionId) => {
  try {
    // Phân loại truy vấn để xác định loại thông tin mà người dùng đang tìm kiếm
    const queryType = classifyQuery(userQuery);
    let prompt;
    let result;

    switch (queryType) {
      case 'doctor':
        prompt = await createDoctorSearchPrompt(userQuery);
        result = await generateDoctorResponse(prompt);
        break;
      case 'specialty':
        prompt = await createSpecialtySearchPrompt(userQuery);
        result = await generateSpecialtyResponse(prompt);
        break;
      case 'clinic':
        prompt = await createClinicSearchPrompt(userQuery);
        result = await generateClinicResponse(prompt);
        break;
      default:
        result = await generateGeneralResponse(userQuery);
        break;
    }

    // Lưu lịch sử chat
    if (!result.error) {
      // Nếu không có sessionId, tạo mới
      if (!sessionId) {
        sessionId = uuidv4();
      }
      
      // Lưu vào database
      await saveChatHistory(userId, sessionId, userQuery, result.response, queryType);
    }

    // Trả về kết quả và sessionId
    return { ...result, sessionId };
  } catch (error) {
    console.error('Error processing user query:', error);
    return { error: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.' };
  }
};

// Lưu lịch sử chat
const saveChatHistory = async (userId, sessionId, message, response, messageType) => {
  try {
    await db.ChatHistory.create({
      userId: userId || null, // Nếu không có userId (người dùng chưa đăng nhập) thì lưu null
      sessionId: sessionId,
      message: message,
      response: response,
      messageType: messageType,
    });
    return true;
  } catch (error) {
    console.error('Error saving chat history:', error);
    return false;
  }
};

// Lấy lịch sử chat theo sessionId
export const getChatHistoryBySessionId = async (sessionId) => {
  try {
    const history = await db.ChatHistory.findAll({
      where: { sessionId: sessionId },
      order: [['createdAt', 'ASC']],
      raw: true
    });
    
    return {
      errCode: 0,
      errMessage: "OK",
      data: history
    };
  } catch (error) {
    console.error('Error getting chat history:', error);
    return {
      errCode: 1,
      errMessage: "Không thể lấy lịch sử chat",
      data: null
    };
  }
};

// Lấy lịch sử chat theo userId
export const getChatHistoryByUserId = async (userId) => {
  try {
    // Lấy tất cả các sessionId của user
    const sessions = await db.ChatHistory.findAll({
      attributes: ['sessionId', [db.sequelize.fn('MAX', db.sequelize.col('createdAt')), 'lastActivity']],
      where: { userId: userId },
      group: ['sessionId'],
      order: [[db.sequelize.literal('lastActivity'), 'DESC']],
      raw: true
    });
    
    // Lấy tin nhắn đầu tiên của mỗi session để hiển thị preview
    const sessionPreviews = await Promise.all(sessions.map(async (session) => {
      const firstMessage = await db.ChatHistory.findOne({
        where: { sessionId: session.sessionId },
        order: [['createdAt', 'ASC']],
        limit: 1,
        raw: true
      });
      
      return {
        sessionId: session.sessionId,
        lastActivity: session.lastActivity,
        previewMessage: firstMessage ? firstMessage.message : '',
        userId: userId
      };
    }));
    
    return {
      errCode: 0,
      errMessage: "OK",
      data: sessionPreviews
    };
  } catch (error) {
    console.error('Error getting user chat history:', error);
    return {
      errCode: 1,
      errMessage: "Không thể lấy lịch sử chat của người dùng",
      data: null
    };
  }
};

// Phân loại truy vấn
const classifyQuery = (query) => {
  query = query.toLowerCase();
  if (query.includes('bác sĩ') || query.includes('doctor') || query.includes('chuyên gia') || query.includes('bs')) {
    return 'doctor';
  } else if (query.includes('chuyên khoa') || query.includes('specialty') || query.includes('khoa')) {
    return 'specialty';
  } else if (query.includes('phòng khám') || query.includes('clinic') || query.includes('bệnh viện') || query.includes('cơ sở y tế')) {
    return 'clinic';
  } else {
    return 'general';
  }
};

// Tạo phản hồi cho truy vấn về bác sĩ
const generateDoctorResponse = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh. 
    Hãy tìm kiếm thông tin về bác sĩ dựa trên dữ liệu được cung cấp.
    Dữ liệu bác sĩ: ${prompt.doctorsInfo}
    
    Hãy cung cấp thông tin chi tiết về bác sĩ phù hợp với yêu cầu tìm kiếm. 
    Nếu có nhiều bác sĩ phù hợp, hãy liệt kê 3-5 bác sĩ phù hợp nhất.
    Format trả lời ngắn gọn, dễ hiểu.
    Nếu không tìm thấy bác sĩ phù hợp, hãy đề xuất tìm kiếm theo chuyên khoa hoặc cơ sở y tế.
    `;

    const result = await model.generateContent([
      systemInstruction,
      `Yêu cầu tìm kiếm bác sĩ: ${prompt.query}`
    ]);
    
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating doctor response:', error);
    return { error: 'Không thể tạo phản hồi cho truy vấn về bác sĩ.' };
  }
};

// Tạo phản hồi cho truy vấn về chuyên khoa
const generateSpecialtyResponse = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh. 
    Hãy tìm kiếm thông tin về chuyên khoa dựa trên dữ liệu được cung cấp.
    Dữ liệu chuyên khoa: ${prompt.specialtiesInfo}
    
    Hãy cung cấp thông tin chi tiết về chuyên khoa phù hợp với yêu cầu tìm kiếm.
    Nêu rõ tên chuyên khoa, mô tả và các dịch vụ chính.
    Format trả lời ngắn gọn, dễ hiểu.
    Nếu không tìm thấy chuyên khoa phù hợp, hãy đề xuất tìm kiếm theo bác sĩ hoặc cơ sở y tế.
    `;

    const result = await model.generateContent([
      systemInstruction,
      `Yêu cầu tìm kiếm chuyên khoa: ${prompt.query}`
    ]);
    
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating specialty response:', error);
    return { error: 'Không thể tạo phản hồi cho truy vấn về chuyên khoa.' };
  }
};

// Tạo phản hồi cho truy vấn về cơ sở y tế
const generateClinicResponse = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh. 
    Hãy tìm kiếm thông tin về cơ sở y tế dựa trên dữ liệu được cung cấp.
    Dữ liệu cơ sở y tế: ${prompt.clinicsInfo}
    
    Hãy cung cấp thông tin chi tiết về cơ sở y tế phù hợp với yêu cầu tìm kiếm.
    Nêu rõ tên cơ sở y tế, địa chỉ và mô tả.
    Format trả lời ngắn gọn, dễ hiểu.
    Nếu không tìm thấy cơ sở y tế phù hợp, hãy đề xuất tìm kiếm theo bác sĩ hoặc chuyên khoa.
    `;

    const result = await model.generateContent([
      systemInstruction,
      `Yêu cầu tìm kiếm cơ sở y tế: ${prompt.query}`
    ]);
    
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating clinic response:', error);
    return { error: 'Không thể tạo phản hồi cho truy vấn về cơ sở y tế.' };
  }
};

// Tạo phản hồi chung cho các câu hỏi không phân loại được
const generateGeneralResponse = async (query) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh BookingCare.
    Hãy trả lời câu hỏi chung về hệ thống đặt lịch khám bệnh.
    Nếu người dùng có vẻ đang tìm kiếm thông tin, hãy gợi ý họ tìm kiếm theo bác sĩ, chuyên khoa hoặc cơ sở y tế.
    Ví dụ: "Bạn có thể tìm kiếm bác sĩ [chuyên khoa], hoặc tìm thông tin về [chuyên khoa], hoặc tìm kiếm cơ sở y tế [tên cơ sở]."
    Trả lời ngắn gọn, thân thiện và hữu ích.
    `;

    const result = await model.generateContent([
      systemInstruction,
      `Câu hỏi: ${query}`
    ]);
    
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating general response:', error);
    return { error: 'Không thể tạo phản hồi cho câu hỏi của bạn.' };
  }
};