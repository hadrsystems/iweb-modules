/*
 * Copyright (c) 2008-2016, Massachusetts Institute of Technology (MIT)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(["ext", "jquery", "iweb/modules/core-view/ConnectionIndicator"],
    function(Ext, $, ConnectionIndicator) {

		var Toolbar = Ext.define("Core.Toolbar", {
            extend: "Ext.toolbar.Toolbar",
            id: "cToolBar",
            floating: true,
            draggable: true,
            border: 5,
            x: 150,
            y: 100
        });

        var Viewer = Ext.define("Core.View", {
            extend: "Ext.container.Viewport",
            requires: [
                "Ext.layout.container.Border",
                "Ext.layout.container.VBox",
                "Ext.toolbar.Toolbar"
            ],
            layout: "border",
            bodyBorder: false,

            items: [
                {
                    region: "north",
                    height: 70,
                    collapsible: false,
                    layout: "vbox",
                    border: false,
                    items: [
                        {
                            id: "cTitleBar",
                            xtype: "toolbar",
                            width: "100%",
                            height: 35,
                            border: false
                        },
                        {
                            id: "cButtonBar",
                            xtype: "toolbar",
                            width: "100%",
                            height: 35,
                            border: false
                        }
                    ]
                },
                {
                    id: "cSidePanel",
                    xtype: "tabpanel",
                    title: "Side Panel",
                    region: "east",
                    floatable: false,
                    collapsible: true,
                    collapsed: true,
                    titleCollapse: true,
                    split: true,
                    width: 600
                },
                {
                    id: "cMainComponent",
                    header: false,
                    collapsible: false,
                    layout: 'fit',
                    region: "center",
                    margin: "5 0 0 0",
                    border: false
                },
                {
                    id: "cBottomPanel",
                    xtype: "tabpanel",
                    title: "Chat",
                    region: "south",
                    floatable: false,
                    collapsible: true,
                    collapsed: true,
                    titleCollapse: true,
                    split: true,
                    height: 200
                }
            ]
        });


        Viewer.prototype.init = function() {
            this.mainContentPanel = this.query("#cMainComponent")[0];
            this.sidePanel = this.query("#cSidePanel")[0];
            this.titleBar = this.query("#cTitleBar")[0];
            this.buttonBar = this.query("#cButtonBar")[0];
            this.bottomPanel = this.query("#cBottomPanel")[0];
            this.toolbar = null;
        };
        
        Viewer.prototype.setMainContentComponent = function(component) {
            this.mainContentPanel.add(component);
            //this.mainContentPanel.doLayout();
        };

        Viewer.prototype.getMainContentComponent = function() {
            return this.mainContentPanel;
        };

        Viewer.prototype.getMainContentEl = function() {
            return this.mainContentPanel.body.dom;
        };

        /**
         * function: setSideComponent
         * 
         * Deprecated, remove this method, it's being configured as a tabpanel now, and we'll add to it
         * with the addToSidePanel method below...
         */
        Viewer.prototype.setSideComponent = function(component) {
            this.sidePanel.add(component);
        };
        
        /**
         * function: addToSidePanel
         * 
         * component: A component that will display in a tab on the side Tab Panel, should include a 
         * 				title parameter, or else the tab will be titled... what? TODO:
         */
        Viewer.prototype.addToSidePanel = function(component) {
        	if(!component) {
        		if(console) {
        			console.log("Component passed to Core.View.addToSidePanel is undefined; not adding.");
        		}
        		return;
        	}
        	this.sidePanel.add(component);
        };

        Viewer.prototype.addToTitleBar = function(components) {
            this.titleBar.add(components);
           // this.titleBar.doLayout();
        };

        Viewer.prototype.addButtonPanel = function(buttonPanel) {
            this.buttonBar.add(buttonPanel);
            //this.buttonBar.doLayout();
        };

        Viewer.prototype.insertButtonPanel = function(index, buttons) {
            if ($.isArray(buttons)) {
                for (var i = 0; i < buttons.length; i++) {
                    this.buttonBar.insert(index, buttons[i]);
                    index++;
                }
            } else {
                this.buttonBar.insert(index, buttons);
            }
            //this.buttonBar.doLayout();
        };

        Viewer.prototype.removeButtonFromPanel = function(button) {
            this.buttonBar.remove(button);
            //this.buttonBar.doLayout();
        };

        Viewer.prototype.showToolbar = function(show) {
            this.toolbar = new Toolbar();
            this.toolbar.setVisible(show);
        };
        
        Viewer.prototype.showDisconnect = function(show){
        	if(show){
        		this.disconnect = new ConnectionIndicator();
        		this.disconnect.show();
        	}
        }

        Viewer.prototype.addToolbarButton = function(button) {
            this.toolbar.add(button);
        };

        Viewer.prototype.getBottomPanel = function(panel) {
        	return this.bottomPanel;
        };
        
        Viewer.prototype.addToBottomPanel = function(panel) {
            this.bottomPanel.add(panel);
        };

        Viewer.prototype.removeFromBottomPanel = function(panel) {
            this.bottomPanel.remove(panel);
        };

        Viewer.prototype.showSidePanel = function() {
            if(this.sidePanel.collapsed) {
                this.sidePanel.toggleCollapse();
            }
        };

        Viewer.prototype.setActiveTabOnSidePanel = function(tab) {
            this.sidePanel.setActiveTab(tab);
        };

        return Viewer;
    }
);
