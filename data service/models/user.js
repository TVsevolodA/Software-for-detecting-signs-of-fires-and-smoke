//@ts-check

module.exports= class User{
    constructor(db, user_data) {
        this.pool = db;
        this.user_id = user_data.user_id;
        this.username = user_data.username;
        this.email = user_data.email;
        this.password_hash = user_data.password_hash;
        this.role = user_data.role;
    }

    static withoutId(db, user_data) { 
        user_data.user_id = -1;
        return new User(db, user_data);
    }

    static systemUser(db) {
        let user_data = {};
        user_data.user_id = -1;
        user_data.username = '';
        user_data.email = '';
        user_data.password_hash = '';
        user_data.role = 'system';
        return new User(db, user_data);
    }

    async insertWithReturnId() {
    }

    async getUserRole(duty) {
        return (await this.pool.query("SELECT role FROM users WHERE user_id = $1;", [duty])).rows[0].role;
    }

    async searchSystemUser() {
        return (await this.pool.query("SELECT user_id FROM users WHERE role = 'system';")).rows[0].user_id;
    }
}