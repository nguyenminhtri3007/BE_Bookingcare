import db from "../models";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyCpQBr4evBkblM_xGFDcLGG_ntDj70nbzw");

const createDoctorSearchPrompt = async (query) => {
  try {
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
          attributes: ["specialtyId", "priceId"],
          include: [
            {
              model: db.Specialty,
              as: "specialtyData",
              attributes: ["name"],
            },
            {
              model: db.Allcode,
              as: "priceTypeData",
              attributes: ["valueVi", "valueEn"],
            }
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

     const today = new Date();
    today.setHours(0,0,0,0);
    const start = today.getTime();
    const end = (new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)).getTime();

   const doctorSchedules = await Promise.all(doctors.map(async (doctor) => {
      const schedules = await db.Schedule.findAll({
        where: { 
           doctorId: doctor.id ,
           date: { [Op.gte]: start, [Op.lt]: end }
          },
        include: [
          {
            model: db.Allcode,
            as: "timeTypeData",
            attributes: ["valueVi"],
          }
        ],
        raw: false,
        nest: true,
      });

      return {
        doctorId: doctor.id,
        schedules: schedules.map(schedule => ({
         date: new Date(Number(schedule.date)).toLocaleDateString('vi-VN'),
          timeType: schedule.timeTypeData.valueVi,
          currentNumber: schedule.currentNumber,
          maxNumber: schedule.maxNumber,
          availableSlots: schedule.maxNumber - schedule.currentNumber
        }))
      };
    }));

    // Chuyển đổi dữ liệu bác sĩ thành chuỗi để đưa vào prompt
   const doctorsDataWithReviews = await Promise.all(doctors.map(async (doctor) => {
      const doctorSchedule = doctorSchedules.find(ds => ds.doctorId === doctor.id);

      const reviews = await db.Review.findAll({
        where: { doctorId: doctor.id },
        include: [
          {
            model: db.User,
            as: "patientReviewData",
            attributes: ["firstName", "lastName"]
          }
        ],
        order: [["createdAt", "DESC"]],
        limit: 2, 
        raw: false,
        nest: true
      });

      const formattedReviews = reviews.map(review => ({
        patientName: `${review.patientReviewData?.lastName || ''} ${review.patientReviewData?.firstName || ''}`.trim() || 'Bệnh nhân ẩn danh',
        comment: review.comment
      })).filter(r => r.comment); 

       // Format price information - keep numeric format
      let priceInfo = '';
      if (doctor.Doctor_Infor && doctor.Doctor_Infor.priceTypeData) {
        const price = doctor.Doctor_Infor.priceTypeData.valueVi;
        if (!isNaN(price)) {
          // Format price with dots for thousands and add đ symbol
          priceInfo = `${parseInt(price).toLocaleString('vi-VN')}đ`;
        } else {
          priceInfo = price;
        }
      }

      return {
        id: doctor.id,
        name: `${doctor.lastName} ${doctor.firstName}`,
        position: doctor.positionData ? doctor.positionData.valueVi : '',
        specialty: doctor.Doctor_Infor && doctor.Doctor_Infor.specialtyData ? doctor.Doctor_Infor.specialtyData.name : '',
        description: doctor.Markdown ? doctor.Markdown.description : '',
        content: doctor.Markdown ? doctor.Markdown.contentMarkdown : '',
        schedules: doctorSchedule ? doctorSchedule.schedules : [],
        reviews: formattedReviews,
        price: priceInfo
      };
 }));
     const doctorsInfoString = JSON.stringify(doctorsDataWithReviews);
    // Tạo prompt
    return {
       doctorsInfo: doctorsInfoString,
      query: query
    };
  } catch (error) {
    console.error('Error creating doctor search prompt:', error);
    return { error: 'Không thể tìm kiếm thông tin bác sĩ.' };
  }
};

const createSpecialtySearchPrompt = async (query) => {
  try {
  
    const specialties = await db.Specialty.findAll({
      attributes: ['id', 'name', 'descriptionMarkdown', 'descriptionHTML'],
      raw: true
    });

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

const createClinicSearchPrompt = async (query) => {
  try {
    
    const clinics = await db.Clinic.findAll({
      attributes: ['id', 'name', 'address', 'descriptionMarkdown'],
      raw: true
    });

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


const getLastDoctorNameFromHistory = (history) => {
  if (!history || !Array.isArray(history)) return null;
  // Duyệt ngược để tìm response có tên bác sĩ
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    // Ưu tiên messageType là 'doctor' và response có "Bác sĩ ..."
    if (entry.messageType === 'doctor' && entry.response) {
      const match = entry.response.match(/Bác sĩ ([^,\n]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    // Nếu user hỏi rõ tên bác sĩ trong message
    if (entry.message && /bác sĩ ([a-zA-ZÀ-ỹ\s]+)/i.test(entry.message)) {
      const match = entry.message.match(/bác sĩ ([a-zA-ZÀ-ỹ\s]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
};

const hasGreetedInSession = (history) => {
  if (!history || !Array.isArray(history)) return false;
  return history.some(entry => entry.response && /(chào bạn|xin chào|rất vui được hỗ trợ)/i.test(entry.response));
};

// Hàm phân tích intent truy vấn bác sĩ
const detectDoctorIntent = (query) => {
  const q = query.toLowerCase();
   if (/giá khám|phí khám|tiền khám|chi phí khám|bao nhiêu tiền|giá bao nhiêu/i.test(q)) {
    return { type: 'price' };
  }
  if (/bác sĩ nữ|bác sĩ là nữ|bác sĩ nữ nào|bác sĩ nữ giỏi|bác sĩ nữ tốt/i.test(q)) return { type: 'female' };
  if (/bác sĩ nam|bác sĩ là nam|bác sĩ nam nào|bác sĩ nam giỏi|bác sĩ nam tốt/i.test(q)) return { type: 'male' };
  if (/bác sĩ trẻ|bác sĩ nhỏ tuổi|bác sĩ trẻ tuổi/i.test(q)) return { type: 'young' };
  if (/bác sĩ lớn tuổi|bác sĩ già|bác sĩ kinh nghiệm/i.test(q)) return { type: 'senior' };
  if (/bác sĩ giỏi|bác sĩ tốt|bác sĩ nhiều review tốt|bác sĩ nhiều đánh giá tốt|bác sĩ nổi bật|bác sĩ uy tín/i.test(q)) return { type: 'topreview' };
  if (/so sánh bác sĩ|bác sĩ nào tốt hơn|bác sĩ nào phù hợp/i.test(q)) return { type: 'compare' };
  return { type: 'default' };
};

// Hàm phân tích intent truy vấn chuyên khoa
const detectSpecialtyIntent = (query) => {
  const q = query.toLowerCase();
  if (/triệu chứng|tôi bị|tôi có|tôi cảm thấy|nên khám khoa gì|khám khoa nào|chuyên khoa phù hợp|bệnh gì|đau ở đâu|đau (họng|bụng|ngực|đầu|lưng|chân|tay)/i.test(q)) return { type: 'symptom' };
  return { type: 'default' };
};

// Hàm chính để xử lý yêu cầu từ người dùng
export const processUserQuery = async (userQuery, userId, sessionId) => {
  try {
    const queryType = classifyQuery(userQuery);
    let prompt;
    let result;
    let chatHistoryForPrompt = '';
    let historyResult = { errCode: 1, data: [] };
    let history = [];

    if (sessionId) {
      historyResult = await getChatHistoryBySessionId(sessionId);
      if (historyResult.errCode === 0 && historyResult.data.length > 0) {
        history = historyResult.data;
        const recentHistory = history.slice(-6);
        chatHistoryForPrompt = recentHistory.map(entry => `${entry.userId ? 'Người dùng' : 'Trợ lý AI'}: ${entry.message || entry.response}`).join('\n');
      }
    }

    let processedUserQuery = userQuery;
    if (queryType === 'doctor' && /(bác sĩ này|bác sĩ đó|bác sĩ ấy|bác sĩ kia|ông ấy|bà ấy)/i.test(userQuery)) {
      const lastDoctorName = getLastDoctorNameFromHistory(history);
      if (lastDoctorName) {
        processedUserQuery = userQuery.replace(/bác sĩ (này|đó|ấy|kia)|ông ấy|bà ấy/gi, `bác sĩ ${lastDoctorName}`);
      }
    }

    let alreadyGreeted = hasGreetedInSession(history);
    let fullQuery = chatHistoryForPrompt ? `${chatHistoryForPrompt}\nNgười dùng: ${processedUserQuery}` : `Người dùng: ${processedUserQuery}`;

    // Intent & lọc danh sách phù hợp
    let doctorIntent = null;
    let specialtyIntent = null;
    let doctorFilter = null;
    let specialtyFilter = null;
    if (queryType === 'doctor') {
      doctorIntent = detectDoctorIntent(processedUserQuery);
      doctorFilter = doctorIntent.type;
    }
    if (queryType === 'specialty') {
      specialtyIntent = detectSpecialtyIntent(processedUserQuery);
      specialtyFilter = specialtyIntent.type;
    }

    switch (queryType) {
      case 'doctor':
        prompt = await createDoctorSearchPrompt(processedUserQuery);
        if (doctorFilter && doctorFilter !== 'default') prompt.doctorFilter = doctorFilter;
        if (alreadyGreeted) prompt.alreadyGreeted = true;
        result = await generateDoctorResponse(prompt, fullQuery, alreadyGreeted);
        break;
      case 'specialty':
        prompt = await createSpecialtySearchPrompt(processedUserQuery);
        if (specialtyFilter && specialtyFilter !== 'default') prompt.specialtyFilter = specialtyFilter;
        if (alreadyGreeted) prompt.alreadyGreeted = true;
        result = await generateSpecialtyResponse(prompt, fullQuery, alreadyGreeted);
        break;
      case 'clinic':
        prompt = await createClinicSearchPrompt(processedUserQuery);
        if (alreadyGreeted) prompt.alreadyGreeted = true;
        result = await generateClinicResponse(prompt, fullQuery, alreadyGreeted);
        break;
      default:
        result = await generateGeneralResponse(fullQuery, alreadyGreeted);
        break;
    }

    if (!result.error) {
      if (!sessionId) {
        sessionId = uuidv4();
      }
      await saveChatHistory(userId, sessionId, userQuery, result.response, queryType);
    }
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
      userId: userId || null, 
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
const generateDoctorResponse = async (prompt, fullQuery, alreadyGreeted = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
     let doctorsInfoToPrompt = JSON.parse(prompt.doctorsInfo);

    if (prompt.doctorFilter !== 'price') {
      doctorsInfoToPrompt = doctorsInfoToPrompt.map(doctor => {
        const { price, ...rest } = doctor;
        return rest;
      });
    }

    let systemInstruction = `
     Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh BookingCare.
    Nhiệm vụ của bạn là cung cấp thông tin về bác sĩ dựa trên dữ liệu sau: ${JSON.stringify(doctorsInfoToPrompt)}
    QUAN TRỌNG NHẤT: YÊU CẦU CỦA NGƯỜI DÙNG có thể bao gồm LỊCH SỬ TRÒ CHUYỆN. Hãy PHÂN TÍCH KỸ LỊCH SỬ này.
    - Nếu câu hỏi hiện tại của người dùng không nêu rõ tên bác sĩ (ví dụ: "bác sĩ này", "ông ấy", "lịch khám của bác sĩ đó ra sao?"), BẠN PHẢI TỰ SUY LUẬN xem người dùng đang ám chỉ bác sĩ nào dựa vào tên bác sĩ đã được nhắc đến gần nhất trong lịch sử trò chuyện.
    - Sau khi xác định được bác sĩ từ lịch sử (nếu cần), hãy sử dụng thông tin bác sĩ đó trong dữ liệu doctorsInfo (nếu có) để trả lời.
    - Nếu dữ liệu doctorsInfo trống hoặc không khớp với bác sĩ suy luận từ lịch sử, hãy lịch sự yêu cầu người dùng cung cấp lại tên bác sĩ cụ thể.
    - Nếu prompt.doctorFilter là 'female', chỉ ưu tiên trả lời về các bác sĩ nữ. Nếu là 'male', chỉ ưu tiên bác sĩ nam. Nếu là 'topreview', ưu tiên bác sĩ có nhiều đánh giá tốt. Nếu là 'young', ưu tiên bác sĩ trẻ. Nếu là 'senior', ưu tiên bác sĩ lớn tuổi/kinh nghiệm. Nếu là 'compare', hãy so sánh các bác sĩ phù hợp nhất.
    - Nếu có nhiều bác sĩ phù hợp, hãy liệt kê 3-5 bác sĩ phù hợp nhất, kèm mô tả ngắn gọn từng người.
    - Luôn gợi ý thêm các lựa chọn liên quan nếu có.
    - Trả lời đa dạng, linh hoạt, không lặp lại một mẫu câu.
    Hãy xử lý yêu cầu của người dùng theo các trường hợp sau (sau khi đã xác định đúng bác sĩ đang được nói đến):
    1.  **Nếu người dùng hỏi thông tin chung về bác sĩ** (ví dụ: "Thông tin bác sĩ X", "Bác sĩ X là ai?"):
        *   Chỉ cung cấp: Tên đầy đủ (bao gồm học hàm/vị trí), chuyên khoa, và vị trí công tác của bác sĩ.
        *   Sau đó, gợi ý rằng người dùng có thể hỏi thêm về "lịch khám" hoặc "đánh giá" của bác sĩ.
    2.  **Nếu người dùng hỏi cụ thể về lịch khám của bác sĩ** (ví dụ: "Lịch khám bác sĩ X?", "Bác sĩ X có lịch làm việc ngày mai không?"):
        *   Cung cấp: Tên đầy đủ, chuyên khoa, vị trí công tác.
        *   Sau đó, cung cấp chi tiết lịch khám trong những ngày tới (nếu có), bao gồm: Ngày khám, Ca khám (ví dụ: 8:00 - 9:00), và Số lượng chỗ còn trống.
        *   Format lịch khám rõ ràng, dễ đọc.
        *   Nếu không có lịch khám, hãy thông báo: "Hiện tại bác sĩ X chưa có lịch khám trong thời gian tới. Bạn có thể tham khảo bác sĩ khác cùng chuyên khoa."
    3.  **Nếu người dùng hỏi về chất lượng hoặc đánh giá của bác sĩ** (ví dụ: "Bác sĩ X khám có tốt không?", "Review bác sĩ X", "Đánh giá về bác sĩ X"):
        *   Cung cấp: Tên đầy đủ, chuyên khoa, vị trí công tác.
        *   Sau đó, trích dẫn tối đa 2 đánh giá gần đây nhất của bệnh nhân về bác sĩ đó (nếu có trong dữ liệu 'reviews').
        *   Định dạng đánh giá: "Bệnh nhân [Tên bệnh nhân]: [Nội dung đánh giá]"
        *   Nếu không có đánh giá nào, hãy thông báo: "Hiện tại chưa có đánh giá nào cho bác sĩ X. Bạn có thể xem lịch khám của bác sĩ."
    4.  **Nếu có nhiều bác sĩ phù hợp với một yêu cầu chung (không chỉ rõ tên bác sĩ)**, hãy liệt kê 3-5 bác sĩ phù hợp nhất dựa trên truy vấn, ưu tiên theo filter nếu có.KHÔNG BAO GỒM GIÁ KHÁM.
   5. **Nếu người dùng hỏi về giá khám** (ví dụ: "Giá khám của bác sĩ X?", "Phí khám bác sĩ Y bao nhiêu?", "Chi phí khám của bác sĩ Z?"):
        * Cung cấp: Tên đầy đủ, chuyên khoa.
        * Sau đó, nêu rõ giá khám theo định dạng số (ví dụ: "500.000đ").
        * Nếu không có thông tin giá khám, hãy thông báo: "Hiện tại chưa có thông tin về giá khám của bác sĩ X. Bạn có thể liên hệ trực tiếp với phòng khám để biết thêm chi tiết."
        * Nếu người dùng hỏi so sánh giá khám giữa các bác sĩ, hãy liệt kê giá khám của các bác sĩ phù hợp để so sánh.
    
    **Lưu ý chung:**
    *   Luôn trả lời bằng tiếng Việt, lịch sự và rõ ràng.
    *   Nếu không tìm thấy thông tin bác sĩ theo tên được yêu cầu, hãy thông báo không tìm thấy và gợi ý tìm kiếm theo chuyên khoa hoặc tên khác.
    *   Ưu tiên thông tin chính xác từ dữ liệu được cung cấp.
    *   Trả lời đa dạng, không lặp lại một mẫu câu.
    `;
    if (alreadyGreeted) {
      systemInstruction += '\nQUAN TRỌNG: Không cần chào lại người dùng nếu đã chào trong hội thoại này.';
    }
    const result = await model.generateContent([
      systemInstruction,
       `Yêu cầu của người dùng: ${prompt.query}`
    ]);
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating doctor response:', error);
    return { error: 'Không thể tạo phản hồi cho truy vấn về bác sĩ.' };
  }
};

// Tạo phản hồi cho truy vấn về chuyên khoa
const generateSpecialtyResponse = async (prompt, fullQuery, alreadyGreeted = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh. 
    Hãy tìm kiếm thông tin về chuyên khoa dựa trên dữ liệu được cung cấp.
    Dữ liệu chuyên khoa: ${prompt.specialtiesInfo}
    - Nếu prompt.specialtyFilter là 'symptom', hãy cố gắng phân tích triệu chứng hoặc mô tả của người dùng để gợi ý chuyên khoa phù hợp nhất.
    - Nếu có nhiều chuyên khoa phù hợp, hãy liệt kê 2-3 chuyên khoa liên quan, kèm mô tả ngắn gọn.
    - Trả lời đa dạng, linh hoạt, không lặp lại một mẫu câu.
    Hãy cung cấp thông tin chi tiết về chuyên khoa phù hợp với yêu cầu tìm kiếm.
    Nêu rõ tên chuyên khoa, mô tả và các dịch vụ chính.
    Format trả lời ngắn gọn, dễ hiểu.
    Nếu không tìm thấy chuyên khoa phù hợp, hãy đề xuất tìm kiếm theo bác sĩ hoặc cơ sở y tế.
    `;
    if (alreadyGreeted) {
      systemInstruction += '\nQUAN TRỌNG: Không cần chào lại người dùng nếu đã chào trong hội thoại này.';
    }
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
const generateClinicResponse = async (prompt, fullQuery, alreadyGreeted = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let systemInstruction = `
    Bạn là một trợ lý ảo cho hệ thống đặt lịch khám bệnh. 
    Hãy tìm kiếm thông tin về cơ sở y tế dựa trên dữ liệu được cung cấp.
    Dữ liệu cơ sở y tế: ${prompt.clinicsInfo}
    Hãy cung cấp thông tin chi tiết về cơ sở y tế phù hợp với yêu cầu tìm kiếm.
    Nêu rõ tên cơ sở y tế, địa chỉ và mô tả.
    Format trả lời ngắn gọn, dễ hiểu.
    Nếu không tìm thấy cơ sở y tế phù hợp, hãy đề xuất tìm kiếm theo bác sĩ hoặc chuyên khoa.
    `;
    if (alreadyGreeted) {
      systemInstruction += '\nQUAN TRỌNG: Không cần chào lại người dùng nếu đã chào trong hội thoại này.';
    }
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
const generateGeneralResponse = async (query, alreadyGreeted = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let systemInstruction = `
     Bạn là trợ lý ảo của hệ thống đặt lịch khám bệnh BookingCare.
    Nhiệm vụ của bạn là hỗ trợ người dùng và trả lời các câu hỏi chung.
    Hãy cố gắng hiểu ý định của người dùng:
    *   Nếu người dùng chào hỏi, hãy chào lại một cách thân thiện.
    *   Nếu người dùng hỏi về chức năng của hệ thống (ví dụ: "Bạn có thể làm gì?", "Hệ thống này dùng để làm gì?"), hãy giải thích ngắn gọn rằng bạn có thể giúp tìm bác sĩ, chuyên khoa, cơ sở y tế, xem lịch khám và đặt lịch.
    *   Nếu câu hỏi không rõ ràng hoặc không liên quan đến y tế/đặt lịch, hãy nhẹ nhàng thông báo rằng bạn chuyên về hỗ trợ đặt lịch khám và gợi ý họ hỏi về bác sĩ, chuyên khoa, hoặc phòng khám.
        Ví dụ: "Tôi có thể giúp bạn tìm thông tin bác sĩ, chuyên khoa, hoặc cơ sở y tế. Bạn cần hỗ trợ gì cụ thể ạ?"
    *   Nếu người dùng có vẻ muốn tìm kiếm thông tin y tế cụ thể, hãy khuyến khích họ sử dụng các từ khóa như "bác sĩ [tên/chuyên khoa]", "chuyên khoa [tên chuyên khoa]", "phòng khám [tên/địa điểm]".
        Ví dụ: "Để tìm bác sĩ, bạn có thể hỏi 'Tìm bác sĩ chuyên khoa Tim Mạch' hoặc 'Thông tin bác sĩ Nguyễn Văn A'."
    *   Nếu người dùng cảm ơn, hãy đáp lại lịch sự.
    Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện và hữu ích.
    `;
    if (alreadyGreeted) {
      systemInstruction += '\nQUAN TRỌNG: Không cần chào lại người dùng nếu đã chào trong hội thoại này.';
    }
    const result = await model.generateContent([
      systemInstruction,
      `Câu hỏi từ người dùng: ${query}`
    ]);
    return { response: result.response.text() };
  } catch (error) {
    console.error('Error generating general response:', error);
    return { error: 'Không thể tạo phản hồi cho câu hỏi của bạn.' };
  }
};

export const deleteChatHistory = async (sessionId, userId) => {
  try {
    const whereClause = { sessionId };
    if (userId) {
      whereClause.userId = userId;
    }

    await db.ChatHistory.destroy({
      where: whereClause
    });

    return {
      errCode: 0,
      errMessage: "Xóa lịch sử chat thành công",
      data: null
    };
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return {
      errCode: 1,
      errMessage: "Không thể xóa lịch sử chat",
      data: null
    };
  }
};