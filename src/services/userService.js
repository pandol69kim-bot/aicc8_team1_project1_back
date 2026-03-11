export const getAllUsers = async () => {
    // 실제 데이터베이스 접근 로직
    // return await User.find();
    return [];
};

export const createUser = async (userData) => {
    // 실제 데이터베이스 접근 및 비즈니스 로직
    // const user = new User(userData);
    // return await user.save();
    return userData;
};

// test