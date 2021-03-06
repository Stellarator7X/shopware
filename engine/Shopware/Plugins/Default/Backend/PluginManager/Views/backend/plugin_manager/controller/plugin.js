
//{namespace name=backend/plugin_manager/translation}
Ext.define('Shopware.apps.PluginManager.controller.Plugin', {

    extend:'Ext.app.Controller',

    refs: [
        { ref: 'localListing', selector: 'plugin-manager-local-plugin-listing' }
    ],

    mixins: {
        events: 'Shopware.apps.PluginManager.view.PluginHelper'
    },

    snippets: {
        'licencePluginDownloadInstall':  '{s name="licence_plugin_download_and_install"}{/s}',
        'licencePluginDownloadActivate': '{s name="licence_plugin_install_and_activate"}{/s}',
        'licencePluginActivate':         '{s name="licence_plugin_activate"}{/s}',

        newRegistrationForm: {
            successTitle: '{s name=newRegistrationForm/successTitle}Shopware ID registration{/s}',
            successMessage: '{s name=newRegistrationForm/successMessage}Your Shopware ID has been successfully registered{/s}',
            waitTitle: '{s name=newRegistrationForm/waitTitle}Registering your Shopware ID{/s}',
            waitMessage: '{s name=newRegistrationForm/waitMessage}This process might take a few seconds{/s}'
        },

        domainRegistration: {
            successTitle: '{s name=domainRegistration/successTitle}Domain registration{/s}',
            successMessage: '{s name=domainRegistration/successMessage}Domain registration successful{/s}',
            waitTitle: '{s name=domainRegistration/waitTitle}Registering domain{/s}',
            waitMessage: '{s name=domainRegistration/waitMessage}This process might take a few seconds{/s}',
            validationFailed: "{s name=domainRegistration/validationFailed}<p>You have successfully logged in using your Shopware ID, but the domain validation process failed.<br><p>Please click <a href='http://en.wiki.shopware.com/Shopware-ID-Shopware-Account_detail_1433.html#Add_shop_.2F_domain' target='_blank'>here</a> to use manual domain validation.</p>{/s}"
        },

        login: {
            successTitle: '{s name=login/successTitle}Shopware ID{/s}',
            successMessage: '{s name=login/successMessage}Login successful{/s}',
            waitTitle: '{s name=login/waitTitle}Logging in...{/s}',
            waitMessage: '{s name=login/waitMessage}This process might take a few seconds{/s}'
        },

        growlMessage:'{s name=growlMessage}Plugin Manager{/s}'
    },

    init: function() {
        var me = this;

        Shopware.app.Application.on(me.getEventListeners());

        me.callParent(arguments);
    },

    getEventListeners: function() {
        var me = this;

        return {
            'install-plugin':              me.installPlugin,
            'uninstall-plugin':            me.uninstallPlugin,
            'secure-uninstall-plugin':     me.secureUninstallPlugin,
            'reinstall-plugin':            me.reinstallPlugin,
            'activate-plugin':             me.activatePlugin,
            'deactivate-plugin':           me.deactivatePlugin,
            'execute-plugin-update':       me.executePluginUpdate,

            'download-plugin-licence':     me.downloadPluginLicenceDirect,
            'update-plugin':               me.updatePlugin,
            'update-dummy-plugin':         me.updateDummyPlugin,
            'buy-plugin':                  me.purchasePlugin,
            'rent-plugin':                 me.purchasePlugin,
            'download-free-plugin':        me.purchasePlugin,
            'request-plugin-test-version': me.purchasePlugin,
            'import-plugin-licence':       me.importLicenceKey,

            'upload-plugin':               me.uploadPlugin,
            'delete-plugin':               me.deletePlugin,
            'reload-plugin':               me.reloadPlugin,
            'reload-local-listing':        me.reloadLocalListing,
            'save-plugin-configuration':   me.saveConfiguration,
            'store-login':                 me.login,
            'check-store-login':           me.checkLogin,
            'open-login':                  me.openLogin,
            'destroy-login':               me.destroyLogin,
            'store-register':              me.register,
            'check-licence-plugin':        me.checkLicencePlugin,
            scope: me
        };
    },

    uploadPlugin: function(form, callback) {
        var me = this;

        form.submit({
            onSuccess: function(response) {
                var result = Ext.decode(response.responseText);
                if (!result) {
                    result = Ext.decode(response.responseXML.body.childNodes[0].innerHTML);
                }

                if (result.success) {
                    Shopware.Notification.createGrowlMessage('', '{s name="plugin_file_uploaded"}{/s}');
                    if (Ext.isFunction(callback)) {
                        callback();
                    }
                } else {
                    me.displayErrorMessage(result);
                }
            }
        });
    },

    reloadLocalListing: function() {
        var me = this,
            localListing = me.getLocalListing();

        localListing.getStore().load();
    },

    saveConfiguration: function(plugin, form) {
        var me = this;

        form.onSaveForm(form, false, function() {

        });
    },

    updatePlugin: function(plugin, callback) {
        var me = this;

        me.authenticateForUpdate(plugin, function() {
            me.startPluginDownload(plugin, function() {
                me.displayLoadingMask(plugin, '{s name=execute_update}{/s}');
                me.executePluginUpdate(plugin, function() {

                    Shopware.app.Application.fireEvent('load-update-listing', function() {
                        me.hideLoadingMask();
                        callback();
                    })
                });
            });
        });
    },

    updateDummyPlugin: function(plugin, callback) {
        var me = this;

        if (plugin.get('technicalName') == 'SwagLicense') {
            me.checkIonCube(plugin, function() {
                me.startPluginDownload(plugin, callback);
            });
        } else {
            me.startPluginDownload(plugin, callback);
        }
    },

    startPluginDownload: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="initial_download"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginManager action=metaDownload}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.hideLoadingMask();

                var mask = me.createDownloadMask(plugin, response.data, function(fileName) {
                    me.sendAjaxRequest(
                        '{url controller=PluginManager action=extract}',
                        { technicalName: plugin.get('technicalName'), fileName: fileName },
                        callback
                    );
                });

                mask.show();
                mask.startDownload(0);
            }
        );
    },

    purchasePlugin: function(plugin, price, callback) {
        var me = this;

        me.checkout(plugin, price, function(basket) {

            me.displayLoadingMask(plugin, '{s name="order_is_being_executed"}{/s}');

            me.sendAjaxRequest(
                '{url controller="PluginManager" action="purchasePlugin"}',
                {
                    orderNumber: plugin.get('code'),
                    price: basket.get('netPrice'),
                    bookingDomain: basket.get('bookingDomain'),
                    priceType: price.get('type')
                },
                function(response) {
                    me.checkoutWindow.hide();

                    me.startPluginDownload(plugin, function() {
                        me.importPluginLicence(plugin, function() {
                            me.pluginBoughtEvent(plugin);
                            callback();
                        });
                    });
                }
            );
        });
    },

    importPluginLicence: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="licence_is_being_imported"}{/s}');

        me.sendAjaxRequest(
            '{url controller="PluginManager" action="importPluginLicence"}',
            { technicalName: plugin.get('technicalName') },
            callback
        );
    },

    importLicenceKey: function(licence, callback) {
        var me = this;

        me.displayLoadingMask(licence, '{s name="licence_is_being_imported"}{/s}');

        if (!licence.get('licenseKey')) {
            me.hideLoadingMask();
            callback();
            return;
        }

        me.checkIonCube(licence, function() {

            me.checkLicencePlugin(licence, function () {

                me.displayLoadingMask(licence, '{s name="licence_is_being_imported"}{/s}');

                me.sendAjaxRequest(
                    '{url controller="PluginManager" action="importLicenceKey"}',
                    {
                        licenceKey: licence.get('licenseKey')
                    },
                    callback
                );

            }, true);
        });
    },

    downloadPluginLicenceDirect: function(licence, callback) {
        var me = this;

        me.checkIonCube(licence, function() {
            me.checkLicencePlugin(licence, function () {
                me.startPluginDownload(licence, function() {
                    me.importLicenceKey(licence, callback);
                });
            });
        });
    },


    checkout: function(plugin, price, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="open_basket"}{/s}');
        me.checkIonCube(plugin, function() {

            me.checkLicencePlugin(plugin, function() {

                me.checkLogin(function() {

                    var store = Ext.create('Shopware.apps.PluginManager.store.Basket');

                    var positions = [{
                        orderNumber: plugin.get('code'),
                        price: price.get('price'),
                        type: price.get('type'),
                        technicalName: plugin.get('technicalName')
                    }];

                    store.getProxy().extraParams = {
                        positions: Ext.encode(positions)
                    };

                    //add event listener to the model proxy to get access on thrown exceptions
                    store.getProxy().on('exception', function (proxy, response) {
                        response = Ext.decode(response.responseText);
                        me.displayErrorMessage(response);
                    }, me, { single: true });

                    store.load({
                        callback: function(records) {
                            var basket = records[0];

                            me.hideLoadingMask();

                            me.checkoutWindow = me.getView('account.Checkout').create({
                                basket: basket,
                                callback: callback
                            });

                            me.checkoutWindow.show();
                        }
                    });

                });
            });
        });
    },

    checkLicencePlugin: function(plugin, callback, force) {
        var me = this;

        if (plugin && !plugin.get('licenceCheck') && !force) {
            callback();
            return;
        }

        Ext.Ajax.request({
            url: '{url controller=PluginManager action=checkLicencePlugin}',
            method: 'POST',
            success: function(operation, opts) {
                var response = Ext.decode(operation.responseText);

                if (response.success === true && Ext.isFunction(callback)) {
                    callback(response);
                    return;
                }

                var licence = Ext.create('Shopware.apps.PluginManager.model.Plugin', response.data);

                switch(response.state) {
                    case 'download':
                        me.confirmMessage(
                            '{s name="licence_plugin_required_title"}{/s}',
                            me.snippets.licencePluginDownloadInstall,
                            function() {
                                me.updateDummyPlugin(licence, function () {
                                    me.installPlugin(licence, function () {
                                        me.activatePlugin(licence, callback);
                                    });
                                });
                            }
                        );
                        break;

                    case 'install':
                        me.confirmMessage(
                            '{s name="licence_plugin_required_title"}{/s}',
                            me.snippets.licencePluginDownloadActivate,
                            function() {
                                me.installPlugin(licence, function() {
                                    me.activatePlugin(licence, callback);
                                });
                            }
                        );

                        break;

                    case 'activate':
                        me.confirmMessage(
                            '{s name="licence_plugin_required_title"}{/s}',
                            me.snippets.licencePluginActivate,
                            function() {
                                me.activatePlugin(licence, callback);
                            }
                        );

                        break;
                }

            }
        });
    },

    checkIonCube: function(plugin, callback) {
        var me = this;

        if (!plugin.get('encrypted') && !plugin.get('licenceCheck') && !plugin.get('licenceKey')) {
            callback();
            return;
        }

        Ext.Ajax.request({
            url: '{url controller=PluginManager action=checkIonCubeLoader}',
            method: 'POST',
            success: function(operation, opts) {
                var response = Ext.decode(operation.responseText);

                if (response.success === false) {
                    Ext.Msg.alert(
                        '{s name="ion_cube_required_title"}{/s}',
                        '{s name="ion_cube_required_text"}{/s}'
                    );

                    return;
                }

                callback();
            }
        });

    },

    authenticateForUpdate: function(plugin, callback) {
        var me = this;
        
        if (plugin.flaggedAsDummyPlugin()) {
            callback();
        } else {
            me.checkLogin(callback);
        }
    },

    executePluginUpdate: function(plugin, callback) {
        var me = this;

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=update}',
            { technicalName: plugin.get('technicalName') },
            callback
        );
    },

    checkLogin: function(callback) {
        var me = this;

        me.checkAccessToken(function(response) {

            if (response.success == false) {
                me.openLogin(callback);
            } else {

                if (response.hasOwnProperty('shopwareId')) {
                    me.fireRefreshAccountData(response);
                }

                callback();
                return;
            }
        });
    },

    checkAccessToken: function(callback) {
        var me = this;

        Ext.Ajax.request({
            url: '{url controller=PluginManager action=getAccessToken}',
            method: 'POST',
            success: function (operation, opts) {
                var response = Ext.decode(operation.responseText);
                callback(response);
            }
        });
    },

    destroyLogin: function() {
        var me = this;

        me.loginMask.destroy();
        me.loginMask = null;
    },

    openLogin: function(callback) {
        var me = this;

        if(!me.loginMask) {
            me.loginMask = Ext.create('Shopware.apps.PluginManager.view.account.LoginWindow', {
                callback: callback
            }).show();
        }
    },

    login: function(params, callback) {
        var me = this;

        me.splashScreen = Ext.Msg.wait(
            me.snippets.login.waitMessage,
            me.snippets.login.waitTitle
        );

        me.sendAjaxRequest(
            '{url controller=PluginManager action=login}',
            params,
            function(response) {

                response.shopwareId = params.shopwareID;
                me.splashScreen.close();

                if (response.success == true) {
                    Ext.create('Shopware.notification.SubscriptionWarning').checkSecret();

                    Shopware.Notification.createGrowlMessage(
                        me.snippets.login.successTitle,
                        me.snippets.login.successMessage,
                        me.snippets.growlMessage
                    );

                    me.fireRefreshAccountData(response);

                    if (params.registerDomain !== false) {
                        me.submitShopwareDomainRequest(params, callback);
                    } else {
                        me.destroyLogin();
                        callback(response);
                    }
                }
            },
            function(response) {
                me.splashScreen.close();
                me.displayErrorMessage(response, callback);
            }
        );
    },

    register: function(registerData, callback) {
        var me = this;

        me.submitShopwareIdRequest(
            registerData,
            '{url controller="firstRunWizard" action="registerNewId"}',
            callback
        );

    },

    submitShopwareIdRequest: function(params, url, callback) {
        var me = this;

        me.splashScreen = Ext.Msg.wait(
            me.snippets.newRegistrationForm.waitMessage,
            me.snippets.newRegistrationForm.waitTitle
        );

        Ext.Ajax.request({
            url: url,
            method: 'POST',
            params: params,
            callback: function(options, success, response) {
                var result = Ext.JSON.decode(response.responseText, true);

                if (!result || result.success == false) {

                    response = Ext.decode(response.responseText);
                    me.displayErrorMessage(response);

                    me.splashScreen.close();

                } else if (result.success) {
                    Shopware.Notification.createGrowlMessage(
                        me.snippets.newRegistrationForm.successTitle,
                        me.snippets.newRegistrationForm.successMessage,
                        me.snippets.growlMessage
                    );

                    Ext.create('Shopware.notification.SubscriptionWarning').checkSecret();

                    if (params.registerDomain !== false) {
                        me.submitShopwareDomainRequest(params, callback);
                    }

                    response.shopwareId = params.shopwareID;
                    me.fireRefreshAccountData(response);
                    callback(response);
                }
            }
        });
    },

    submitShopwareDomainRequest: function(params, callback) {
        var me = this;

        me.splashScreen = Ext.Msg.wait(
            me.snippets.domainRegistration.waitMessage,
            me.snippets.domainRegistration.waitTitle
        );

        Ext.Ajax.request({
            url: '{url controller="firstRunWizard" action="registerDomain"}',
            method: 'POST',
            params: params,
            success: function(response) {
                var result = Ext.JSON.decode(response.responseText);

                if (!result || result.success == false) {

                    response = Ext.decode(response.responseText);
                    me.displayErrorMessage({ message: me.snippets.domainRegistration.validationFailed });
                    me.displayErrorMessage(response);

                    me.splashScreen.close();

                } else if (result.success) {
                    Shopware.Notification.createGrowlMessage(
                        me.snippets.domainRegistration.successTitle,
                        me.snippets.domainRegistration.successMessage,
                        me.snippets.growlMessage
                    );
                    callback(response);
                }


            }
        });
    },

    installPlugin: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="plugin_is_being_installed"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=installPlugin}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.handleCrudResponse(response, plugin);
                callback(response);
            }
        );
    },

    uninstallPlugin: function(plugin, callback) {
        var me = this;

        if (plugin.allowSecureUninstall()) {
            me.confirmMessage(
                '',
                '{s name="uninstall_remove_data"}{/s}',
                function() {
                    me.doUninstall(plugin, callback);
                },
                function() {
                    me.secureUninstallPlugin(plugin, callback);
                }
            );
        } else {
            me.doUninstall(plugin, callback);
        }

    },

    doUninstall: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="plugin_is_being_uninstalled"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=uninstallPlugin}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.handleCrudResponse(response, plugin);
                callback(response);
            }
        );
    },

    reinstallPlugin: function(plugin, callback) {
        var me = this,
            wasActive = plugin.get('active');

        me.secureUninstallPlugin(plugin, function() {
            me.installPlugin(plugin, function(response) {
                if (wasActive) {
                    me.activatePlugin(plugin, callback);
                } else {
                    callback(response);
                }
            });
        });
    },

    secureUninstallPlugin: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="plugin_is_being_uninstalled"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=secureUninstallPlugin}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.handleCrudResponse(response, plugin);
                callback(response);
            }
        );
    },

    deletePlugin: function(plugin, callback) {
        var me = this;

        me.confirmMessage(
            '{s name="delete_plugin_title"}{/s}',
            '{s name="delete_plugin_confirm"}{/s} ' + plugin.get('label'),
            function() {
                me.displayLoadingMask(plugin, '{s name="plugin_is_being_deleted"}{/s}');
                me.sendAjaxRequest(
                    '{url controller=PluginInstaller action=deletePlugin}',
                    { technicalName: plugin.get('technicalName') },
                    callback
                );
            }
        );
    },

    activatePlugin: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="plugin_is_being_activated"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=activatePlugin}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.handleCrudResponse(response, plugin);
                callback(response);
            }
        );
    },

    deactivatePlugin: function(plugin, callback) {
        var me = this;

        me.displayLoadingMask(plugin, '{s name="plugin_is_being_deactivated"}{/s}');

        me.sendAjaxRequest(
            '{url controller=PluginInstaller action=deactivatePlugin}',
            { technicalName: plugin.get('technicalName') },
            function(response) {
                me.handleCrudResponse(response, plugin);
                callback(response);
            }
        );
    },

    handleCrudResponse: function(response, plugin) {

        if (response.hasOwnProperty('message')) {
            var message = response.message;

            if (Ext.isObject(message)) {
                Shopware.Notification.createStickyGrowlMessage(response.message);
            } else if (Ext.isString(message)) {
                Shopware.Notification.createStickyGrowlMessage({ text: response.message });
            }
        }

        if (response.hasOwnProperty('invalidateCache')) {
            this.clearCache(response.invalidateCache, plugin);
        }
    },

    clearCache: function(caches, plugin) {
        var me = this;

        var message = Ext.String.format(
            '{s name=clear_cache}{/s}',
            caches.join(', ') + '<br><br>'
        );

        me.confirmMessage(
            '',
            message,
            function() {
                if (plugin) {
                    me.displayLoadingMask(plugin, '{s name="cache_process"}{/s}');
                }

                var params = {};

                Ext.each(caches, function(cacheKey) {
                    params['cache[' + cacheKey + ']'] = 'on';
                });

                Ext.Ajax.request({
                    url:'{url controller="Cache" action="clearCache"}',
                    method: 'POST',
                    params: params,
                    callback: function() {
                        if (caches.indexOf('theme') >= 0 || caches.indexOf('frontend') >= 0) {
                            Shopware.app.Application.fireEvent('shopware-theme-cache-warm-up-request');
                        }

                        me.hideLoadingMask();
                    }
                });
            }
        );
    }
});
