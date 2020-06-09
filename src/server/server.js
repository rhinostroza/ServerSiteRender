

import express from 'express';
import dotenv from 'dotenv';
import webpack from 'webpack'

import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { StaticRouter } from 'react-router-dom';
import { renderRoutes } from 'react-router-config'

import reducer from '../frontend/reducers/index';
import initialState from '../frontend/initialState';
import serverRoutes from '../frontend/routes/ServerRoutes';
import helmet from 'helmet';
import getManifest from './getManifest';

dotenv.config();

const { ENV, PORT } = process.env;
const app = express();

if(ENV === 'development')
{
    console.log('Entorno de desarrollo')
    const webpackConfig = require('../../webpack.config')
    const webpackDevMiddleware = require('webpack-dev-middleware')
    const webpackHotMiddleware = require('webpack-hot-middleware')
    const compiler = webpack(webpackConfig);
    const serverConfig = { port: PORT, hot: true};

    app.use(webpackDevMiddleware(compiler,serverConfig))
    app.use(webpackHotMiddleware(compiler))
} else {
    app.use((req, res, next) => {
        if(!req.hasManifest) req.hasManifest = getManifest();
        next();
    })
    app.use(express.static(`${__dirname}/public`))
    //Configuración de seguridad con middleware Helmet
    app.use(helmet())
    app.use(helmet.permittedCrossDomainPolicies())
    //El navegador puede saber de qué servidor nos estamos conectando (Servidor de express sabe el navegador)
    //Con esta configuración desactivamos que el navegador sepa esta información
    //Evitamos ataques dirigidos a servidores node
    app.disable('x-powered-by')
}

const setResponse = (html, preloadedState, manifest) => {

    const mainStyles = manifest ? manifest['main.css']: 'assets/app.css';
    const mainBuild = manifest ? manifest['main.js']: 'assets/app.js';
    const vendorBuild = manifest ? manifest['vendors.js']: 'assets/vendor.js';

    return(`
        <!DOCTYPE html>
        <html>
            <head>
                <link rel="stylesheet" href="${mainStyles}" type="text/css">
                <title>Platzi Video</title>
            </head>
            <body>
                <div id="app">${html}</div>
                <script>
                 window.__PRELOADED_STATE__ = ${JSON.stringify(preloadedState).replace(
                    /</g,
                    '\\u003c'
                )}
        </script>
                <script src="${mainBuild}" type="text/javascript"></script>
                <script src="${vendorBuild}" type="text/javascript"></script>
            </body>
        </html>
`)
}

const renderApp = (req, res) => {
    const store = createStore(reducer, initialState);
    const preloadedState = store.getState();
    const html = renderToString(
        <Provider store={store}>
            <StaticRouter location={req.url} context={{}}>
                {renderRoutes(serverRoutes)}
            </StaticRouter>
        </Provider>
    )

    res.send(setResponse(html, preloadedState, req.hasManifest))
}

//(*) Todas las rutas
app.get('*', renderApp)

app.listen(PORT, (err) => {
    if(err) console.log(err)
    else console.log(`Server running on port ${PORT}`)
})