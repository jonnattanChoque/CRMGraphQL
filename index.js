const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const connectDB = require('./config/db');
const jwt  = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

connectDB();

// servidor
const server = new ApolloServer ({
    typeDefs, 
    resolvers,
    context:({req}) => {
        const token = req.headers['authorization'] || '';
        if (token) {
            try {
                const usuario = jwt.verify(token.replace('Bearer ',''), process.env.SECRETA);
                console.log(usuario);
                return {
                    usuario
                }
            } catch (error) {
                console.log(error);
            }
        }
    }
});
 
// arrancar el servidor
server.listen({port: process.env.PORT || 4000}).then(({url}) =>{
      console.log(`Servidor listo en la URL ${url}`)
})