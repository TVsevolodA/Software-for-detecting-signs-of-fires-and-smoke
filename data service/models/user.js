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
        return (await this.pool.query(`
                                        INSERT INTO users (username, email, password_hash, role)
                                        VALUES ($1, $2, $3, $4) RETURNING user_id;`,
                                        [this.username, this.email, this.password_hash, this.role])
                ).rows[0].user_id;
    }

    async getUserRole(duty) {
        return (await this.pool.query("SELECT role FROM users WHERE user_id = $1;", [duty])).rows[0].role;
    }

    async searchSystemUser() {
        return (await this.pool.query("SELECT user_id FROM users WHERE role = 'system';")).rows[0].user_id;
    }

    async getUserById(user_id) {
        return (await this.pool.query("SELECT * FROM users WHERE user_id = $1;", [user_id])).rows[0];
    }

    async getUserByLogin(login) {
        return (await this.pool.query("SELECT * FROM users WHERE email = $1;", [login])).rows[0];
    }
}