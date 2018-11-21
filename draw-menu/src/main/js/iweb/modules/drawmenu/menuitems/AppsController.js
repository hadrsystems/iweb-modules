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
define(["ol", "iweb/CoreModule", "../Interactions", "./AppsWindow"], function(ol, Core, Interactions, AppsWindow) {
	return Ext.define("drawmenu.AppsController", {
		extend: 'Ext.app.ViewController',
		alias: "controller.drawmenu.appsbutton",
		
		censusMessage: 'Create a census region by clicking the mouse to create each point in the polygon. '
			+ 'Double click when the polygon is complete. '
			+ '<br><br>'
			+ 'Results will open in a new Web browser tab and may take up to a few minutes.',
		
		weatherMessage: 'Create a weather region by clicking the mouse to create each point in the polygon. '
			+'The total area must be less than 1000 square miles. Double click when the polygon is complete. '
			+ '<br><br>'
			+'Results will open in a new Web browser tab.',
		
		wgs84Sphere:  new ol.Sphere(6378137),
			
		/**
		 * Callback when a user selects the Census Application button
		 */
		onCensusClick: function(btn) {
			this.cancelTool();
			
			var style = this.getStyle('Census Region');
			var title = 'Census Application';
			this.buildInteraction(style, this.onDrawCensusArea.bind(this));
			this.buildInstructionsWindow(title, this.censusMessage);
		},
		
		/**
		 * Callback when a user finishes drawing a polygon region for the census application 
		 */
		onDrawCensusArea: function(drawEvent) {
			
			var feature = drawEvent.feature;
			var linearRing = feature.getGeometry().getLinearRing(0).clone();
			//TODO: get projection from map / controller?
			linearRing.transform("EPSG:3857", "EPSG:4326");
			var fmtdCoords = linearRing.getCoordinates().map(function(coords){
				return ol.coordinate.format(coords, "{x},{y}", 14);
			});
			var coordParam = fmtdCoords.join(",");
			
			this.submitForm("POST", "http://ejscreen.epa.gov/mapper/demogreportpdf.aspx", {
				report: "acs2018",
				coords: coordParam,
				feattype: 'polygon',
				radius: '0'
			});
		},
		
		/**
		 * Callback when a user selects the Weather Application button
		 */		
		onWeatherClick: function(btn) {
			this.cancelTool();
			
			var style = this.getStyle('Weather Region');
			var title = 'Weather Application';
			this.buildInteraction(style, this.onDrawWeatherArea.bind(this));
			this.buildInstructionsWindow(title, this.weatherMessage);
		},

		/**
		 * Callback when a user finishes drawing a polygon region for the weather application 
		 */
		onDrawWeatherArea: function(drawEvent) {
			var feature = drawEvent.feature;
			var linearRing = feature.getGeometry().getLinearRing(0).clone();
			//TODO: get projection from map / controller?
			linearRing.transform("EPSG:3857", "EPSG:4326");
			
			var sqMetersArea = this.wgs84Sphere.geodesicArea(linearRing.getCoordinates());
			var sqMilesArea = sqMetersArea / 2589988;
			if (sqMilesArea > 1000) {
				var msg = Ext.String.format(
						"Please select an area less than 1000 square miles (current area: {0} square miles)",
						sqMilesArea.toFixed(2)); 
				Ext.MessageBox.alert("Weather Application", msg, this.clearTool, this);
				return;
			}
			
			//NOAA service expects coords in y,x order
			var fmtdCoords = linearRing.getCoordinates().map(function(coords){
				return ol.coordinate.format(coords, "{y},{x}", 14);
			});
			var coordParam = fmtdCoords.join(",");
			
			this.submitForm("GET", "http://www.nws.noaa.gov/wtf/udaf/MapClick.php", {
				lel: "no",
				uel: "no",
				polygon: coordParam,
				area: "75"
			});
		},
		
		/**
		 * Build the map interaction to handle polygon drawing
		 */
		buildInteraction: function(style, callback) {
			this.activeLayer = new ol.layer.Vector({
				source: new ol.source.Vector(),
				style: style
			});
			Core.Ext.Map.addLayer(this.activeLayer);
			
			this.activeInteraction = Interactions.drawPolygon(this.activeLayer.getSource(), style);
			this.activeInteraction.on("drawstart", this.clearTool.bind(this));
			this.activeInteraction.on("drawend", callback);
			Core.Ext.Map.setInteractions([this.activeInteraction]);
			
			if (this.activeMessage) {
				this.activeMessage.destroy();
			}
		},
		
		/**
		 * Build our instructional window
		 */
		buildInstructionsWindow: function(title, message) {
			
			this.activeMessage = new AppsWindow({
				closeAction: 'destroy',
				title: title,
				message: message,
				callback: this.onMessageBoxClick,
				scope: this
			});
			this.activeMessage.show();
			this.activeMessage.alignTo(document, 't-t');
		},
		
		/**
		 * Post a hidden form to open a window with a POST
		 */
		submitForm: function(method, url, fields) {
			var form = document.createElement("form");
			form.setAttribute("method", method);
			form.setAttribute("target", "_blank");
			form.setAttribute("action", url);
			
			var props = Object.getOwnPropertyNames(fields);
			props.forEach(function(prop){
				var value = fields[prop];
				
				var field = document.createElement("input");
				field.setAttribute("type", "hidden");
				field.setAttribute("name", prop);
				field.setAttribute("value", value);
				form.appendChild(field);
			});
			
			document.body.appendChild(form);
			form.submit();
			document.body.removeChild(form);
		},
		
		/**
		 * Callback when a user interacts with the instructions window
		 */
		onMessageBoxClick: function(btnText, btn) {
			if (btnText === "reset") {
				//reset our tool
				this.resetTool();
			} else if (btnText === "clear") {
				//clear
				this.clearTool();
			} else {
				//canceled
				this.cancelTool();
			}
		},
		
		/**
		 * Reset the interaction
		 */
		resetTool: function() {
			Core.Ext.Map.setInteractions([this.activeInteraction]);
		},
		
		/**
		 * Clear all drawn features
		 */
		clearTool: function() {
			this.activeLayer.getSource().clear();
		},
		
		/**
		 * Cleanup the interaction and window
		 */
		cancelTool: function() {
			if (this.activeInteraction) {
				//switch back to the default interactions
				var defaults = Core.Ext.Map.getDefaultInteractions();
				Core.Ext.Map.setInteractions(defaults);
				
				this.activeInteraction = null;
			}
			
			if (this.activeLayer) {
				Core.Ext.Map.removeLayer(this.activeLayer);
				this.activeLayer = null;
			}
			
			if(this.activeMessage) {
				this.activeMessage.destroy();
				this.activeMessage = null;
			}
		},
		
		getStyle: function(featureText) {
			var styles = this.createStyles(featureText);
			return function(feature, resolution) {
				return styles[feature.getGeometry().getType()];
			};
		},
		
		createStyles : function(featureText){
			var styles = {};
			
			styles["Point"] =
			[new ol.style.Style({
				image: new ol.style.Circle({
					fill: new ol.style.Fill({
						color: 'rgba(255,255,255,0.4)'
					}),
					stroke: new ol.style.Stroke({
						color: 'rgba(255, 204, 51, 1)',
						width: 1.25
					}),
					radius: 5
				}),
				fill: new ol.style.Fill({
					color: 'rgba(255,255,255,0.4)'
				}),
				stroke: new ol.style.Stroke({
					color: 'rgba(255, 204, 51, 1)',
					width: 1.25
				})
			})];
			
			styles["Polygon"] = styles["LineString"]
			= [new ol.style.Style({
				text: new ol.style.Text({
					text: featureText,
					scale: 1.5,
					stroke: new ol.style.Stroke({
						color: "rgba( 255, 204, 51, 0.6)",
						width: 2
					}),
					fill: new ol.style.Fill({
						color: "rgba(0, 0, 0, 0.8)"
					})
				}),
				fill: new ol.style.Fill({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new ol.style.Stroke({
					color: 'rgba(255, 204, 51, 0.8)',
					lineDash: [10, 10],
					width: 3
				})
			})];
			
			return styles;
		}
		
	});

});
