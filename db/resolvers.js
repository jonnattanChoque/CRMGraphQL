const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

const crearToken = (usuario, secreta, expiresIn) => {
    const { id, email, nombre, apellido } = usuario;
    return jwt.sign({id, email, nombre, apellido}, secreta, {expiresIn})
}

const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async(_, {id}) => {
            const producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no encontrado');
            }
            return producto;
        },
        obteneClientes: async() => {
            try {
                const clientes = await Cliente.find({vendedor: ctx.usuario.id.toString() });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obteneClientesVendedor: async(_,{}, ctx) => {
            try {
                const clientes = await Cliente.find({vendedor: ctx.usuario.id});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async(_, {id}, ctx) => {
            const cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Cliente no encontrado');
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes ver este cliente');
            }

            return cliente;
        },
        obtenerPedidos: async() => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async(_,{}, ctx) => {
            try {
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente');
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedido: async(_, {id}, ctx) => {
            const pedido = await Pedido.findById(id);

            if(!pedido){
                throw new Error('Pedido no encontrado');
            }

            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes ver este pedido');
            }

            return pedido;
        },
        obtenerPedidosEstado: async(_, {estado}, ctx) => {
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado});
            return pedidos;
        },
        mejoresClientes: async() => {
            const clientes = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group: {_id: "$cliente", total: {$sum: '$total'}}},
                {$lookup: {from: 'clientes',localField: '_id', foreignField: "_id", as: "cliente"}}
            ])

            return clientes;
        },
        mejoresVendedores: async() => {
            const vendedores = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group: {_id: "$vendedor", total: {$sum: '$total'}}},
                {$lookup: {from: 'usuarios',localField: '_id', foreignField: "_id", as: "vendedor"}},
                {$limit: 3},
                {$sort: {total : -1, _id: 1}}
            ])

            return vendedores;
        },
        buscarProducto: async(_, {texto}) => {
            const productos = await Producto.find({$text: {$search: texto}}).limit(10)
            return productos;
        }
    },
    Mutation: {
        // Usuarios
        nuevoUsuario: async (_, {input}) => {
            const { email, password } = input;
            // revisar si el usuario esta registrado
            const existeUsuario = await Usuario.findOne({email});
            if (existeUsuario){
                throw new Error('El usuario ya está registrado');
            }
            // hashear el password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            // guardar en DB
            try {
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        autenticarUsuario: async (_, {input}) => {
            const { email, password } = input;

            // revisar si el usuario esta registrado
            const existeUsuario = await Usuario.findOne({email});
            if (!existeUsuario){
                throw new Error('El usuario no está registrado');
            }

            // revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password)
            if(!passwordCorrecto){
                throw new Error('La contraseña es incorrecta')
            }
            
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
        },
        // Productos
        nuevoProducto: async (_, {input}) => {
            try {
                const producto = new Producto(input);
                producto.save();
                return producto;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async(_,{id, input}) => {
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no encontrado');
            }

            producto = await Producto.findOneAndUpdate({_id: id}, input, {new: true});
            return producto;
        },
        eliminarProducto: async(_, {id}) => {
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no encontrado');
            }

            await Producto.findOneAndDelete({_id: id});
            return "Producto eliminado";
        },
        // Clientes
        nuevoCliente: async (_, {input}, ctx) => {
            const {email} = input;
            const cliente = await Cliente.findOne({email});
            if(cliente){
                throw new Error('Ese cliente ya está registrado');
            }

            try {
                const nuevoCliente = new Cliente(input);
                nuevoCliente.vendedor = ctx.usuario.id;
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async(_,{id, input}, ctx) => {
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Cliente no encontrado');
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes ver este cliente');
            }

            cliente = await Cliente.findOneAndUpdate({_id: id}, input, {new: true});
            return cliente;
        },
        eliminarCliente: async(_, {id}, ctx) => {
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Cliente no encontrado');
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes eliminar este cliente');
            }

            await Cliente.findOneAndDelete({_id: id});
            return "Cliente eliminado";
        },
        // Pedidos
        nuevoPedido: async (_, {input}, ctx) => {
            //1 revisar si el cliente existe
            const {cliente} = input;
            let clienteExiste = await Cliente.findById(cliente);
            if(!clienteExiste){
                throw new Error('Ese cliente no está registrado');
            }

            //2 revisar si el cliente es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes permiso');
            }

            //3 revisar el stock
            for await (const articulo of input.pedido){
                const {id} = articulo;
                const producto = await Producto.findById(id);

                if(articulo.cantidad > producto.existencia){
                    throw new Error(`El articulo ${producto.nombre} excede la cantidad disponible`)
                }else{
                    producto.existencia = producto.existencia - articulo.cantidad
                    await producto.save();
                }
            }

            //4 Crear pedido
            const nuevoPedido = new Pedido(input);
            nuevoPedido.vendedor = ctx.usuario.id;
            const resultado = await nuevoPedido.save();
            return resultado;
        },
        actualizarPedido: async(_,{id, input}, ctx) => {
            let existePedido = await Pedido.findById(id);

            if(!existePedido){
                throw new Error('Pedido no encontrado');
            }

            if(existePedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes ver este pedido');
            }

            if(input.pedido){
                for await (const articulo of input.pedido){
                    const {id} = articulo;
                    const producto = await Producto.findById(id);

                    if(articulo.cantidad > producto.existencia){
                        throw new Error(`El articulo ${producto.nombre} excede la cantidad disponible`)
                    }else{
                        producto.existencia = producto.existencia - articulo.cantidad
                        await producto.save();
                    }
                }
            }
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
            return resultado;
        },
        eliminarPedido: async(_, {id}, ctx) => {
           let existePedido = await Pedido.findById(id);

            if(!existePedido){
                throw new Error('Pedido no encontrado');
            }

            if(existePedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No puedes ver este pedido');
            }

            await Pedido.findOneAndDelete({_id: id});
            return "Pedido eliminado";
        },
    }
}

module.exports = resolvers;