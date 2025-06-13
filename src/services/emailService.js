require("dotenv").config();
import nodemailer from "nodemailer";

let sendSimpleEmail = async (dataSend) => {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_APP, // generated ethereal user
      pass: process.env.EMAIL_APP_PASSWORD, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '" 👻" <tritb30@gmail.com>', // sender address
    to: dataSend.receiverEmail, // list of receivers
    subject: "Thông tin đặt lịch khám bệnh", // Subject line
    html: getBodyHTMLEmail(dataSend),
  });
};

let getBodyHTMLEmail = (dataSend) => {
  let result = "";
  if (dataSend.language === "vi") {
    result = `
<h3><b>Xin chào ${dataSend.patientName}!</b></h3>
<p>Bạn nhận được email này vì đã đặt lịch khám bệnh online trên mywebsite</p>
<p>Thông tin đặt lịch khám bệnh:</p>
<div><b>Thời gian: ${dataSend.time}</b></div>
<div><b>Bác sĩ: ${dataSend.doctorName}</b></div>

<p>Nếu các thông tin trên là đúng sự thật, vui lòng click vào đường link bên dưới để hoàn tất thủ tục đặt lịch khám bệnh.</p>
<div><a href=${dataSend.redirectLink} target="_blank">Click here</a></div>

<div>Xin chân thành cảm ơn!</div>
`;
  }
  if (dataSend.language === "en") {
    result = `
    <h3><b>Dear ${dataSend.patientName}!</b></h3>
    <p>You received this email because you booked an online medical appointment on mywebsite</p>
    <p>Information to schedule an appointment:</p>
    <div><b>Time: ${dataSend.time}</b></div>
    <div><b>Doctor: ${dataSend.doctorName}</b></div>
    
    <p>If the above information is true, please click on the link below to complete the procedure to book an appointment.</p>
    <div><a href=${dataSend.redirectLink} target="_blank">Click here</a></div>
    
    <div>Sincerely thank!</div>
    `;
  }
  return result;
};

let getBodyHTMLEmailRemedy = (dataSend) => {
  let result = "";
  if (dataSend.language === "vi") {
    result = `
<h3><b>Xin chào ${dataSend.patientName}!</b></h3>
<p>Bạn nhận được email này vì đã đặt lịch khám bệnh online trên mywebsite</p>
<p>Thông tin đơn thuốc được gửi trong file đính kèm.</p>
<div>Xin chân thành cảm ơn!</div>
`;
  }
  if (dataSend.language === "en") {
    result = `
    <h3><b>Dear ${dataSend.patientName}!</b></h3>
    <p>You received this email because you booked an online medical appointment on mywebsite</p>
    <p>bla bla</p>
    <div>Sincerely thank!</div>
    `;
  }
  return result;
};
let sendAttachment = async (dataSend) => {
  return new Promise(async (resolve, reject) => {
    try {
      let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_APP, // generated ethereal user
          pass: process.env.EMAIL_APP_PASSWORD, // generated ethereal password
        },
      });

      // send mail with defined transport object
      let info = await transporter.sendMail({
        from: '"Nguyễn Minh Trí👻" <tritb30@gmail.com>', // sender address
        to: dataSend.email, // list of receivers
        subject: "Thông tin đặt lịch khám bệnh", // Subject line
        html: getBodyHTMLEmailRemedy(dataSend),
        attachments: [
          {
            // encoded string as an attachment
            filename: `remedy-${dataSend.patientId
              }-${new Date().getTime()}.png`,
            content: dataSend.imgBase64.split("base64,")[1],
            encoding: "base64",
          },
        ],
      });

      resolve(true);
    } catch (e) {
      reject(e);
    }
  });
};

let sendForgotPasswordEmail = async (dataSend) => {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_APP, // generated ethereal user
      pass: process.env.EMAIL_APP_PASSWORD, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Nguyễn Minh Trí 👻" <tritb30@gmail.com>', // sender address
    to: dataSend.receiverEmail, // list of receivers
    subject: "Thông tin lấy lại mật khẩu", // Subject line
    html: getBodyHTMLEmailForgotPassword(dataSend),
  });
};

let getBodyHTMLEmailForgotPassword = (dataSend) => {
  let result = "";
  result = `
<h3><b>Xin chào!</b></h3>
<p>Bạn nhận được email này vì đã yêu cầu lấy lại mật khẩu do quên mật khẩu</p>

<p>Nếu yêu cầu lấy lại mật khẩu là đúng sự thật, vui lòng click vào đường link bên dưới để hoàn tất thủ tục lấy lại mật khẩu.</p>
<div><a href=${dataSend.redirectLink} target="_blank">Click here</a></div>

<div>Nếu bạn không yêu cầu lấy lại mật khẩu, hãy bỏ qua email này!</div>
<div>Xin chân thành cảm ơn!</div>
`;
  return result;
};

let getBodyHTMLEmailCancel = (dataSend) => {
  let result = "";
  if (dataSend.language === "vi") {
    result = `
<h3><b>Xin chào ${dataSend.patientName}!</b></h3>
<p>Bạn nhận được email này vì lịch hẹn khám bệnh online của bạn đã bị hủy bởi bác sĩ.</p>
<p>Thông tin lịch hẹn:</p>
<div><b>Thời gian: ${dataSend.time}</b></div>
<div><b>Bác sĩ: ${dataSend.doctorName}</b></div>
<p>Nếu có thắc mắc, vui lòng liên hệ lại với chúng tôi hoặc bác sĩ để biết thêm chi tiết.</p>
<div>Xin chân thành cảm ơn!</div>
`;
  }
  if (dataSend.language === "en") {
    result = `
    <h3><b>Dear ${dataSend.patientName}!</b></h3>
    <p>Your online medical appointment has been cancelled by the doctor.</p>
    <p>Appointment information:</p>
    <div><b>Time: ${dataSend.time}</b></div>
    <div><b>Doctor: ${dataSend.doctorName}</b></div>
    <p>If you have any questions, please contact us or your doctor for more details.</p>
    <div>Sincerely thank!</div>
    `;
  }
  return result;
};

let sendCancelBookingEmail = async (dataSend) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_APP,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: '" 👻" <tritb30@gmail.com>',
    to: dataSend.receiverEmail,
    subject: dataSend.language === "vi" ? "Thông báo hủy lịch khám bệnh" : "Appointment Cancellation Notice",
    html: getBodyHTMLEmailCancel(dataSend),
  });
};

module.exports = {
  sendSimpleEmail: sendSimpleEmail,
  sendAttachment: sendAttachment,
  sendForgotPasswordEmail: sendForgotPasswordEmail,
  sendCancelBookingEmail: sendCancelBookingEmail,
};
