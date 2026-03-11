import nodemailer from 'nodemailer';

// TODO: .env 파일에 EMAIL_USER, EMAIL_PASS 추가 필요 (예: 구글 앱 비밀번호)
const transporter = nodemailer.createTransport({
    service: 'gmail', // 이용하는 메일 서비스에 따라 변경 가능
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendVerificationEmail = async (email, code) => {
    // 만약 테스트 환경이거나 EMAIL 설정이 안 되어있다면 콘솔에만 출력
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ [경고] 이메일 설정(EMAIL_USER, EMAIL_PASS)이 없습니다. 콘솔에만 인증 코드를 출력합니다.');
        console.log(`[메일 발송 시뮬레이션] To: ${email}, Code: ${code}`);
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '비밀번호 재설정 인증 코드',
        text: `안녕하세요.\n\n비밀번호 재설정을 위한 6자리 인증 코드입니다:\n\n[ ${code} ]\n\n이 코드는 5분 동안만 유효합니다.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[이메일 전송 완료] ${email}`);
    } catch (error) {
        console.error('이메일 전송 실패:', error);
        throw new Error('이메일 전송에 실패했습니다.');
    }
};
