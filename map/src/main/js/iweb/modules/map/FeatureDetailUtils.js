define(['ext'], function(Ext) {

	return Ext.define('FeatureDetailUtils', {
		static: {
			calculateFeatureDetailsContainerXY: function (eventLocalXY, container, mapSize) {
				var containerLocalXY = eventLocalXY;
				var containerXMax = eventLocalXY[0] + container.getWidth();
				containerLocalXY[0] = (containerXMax - mapSize[0] >= 0) ? (eventLocalXY[0] - container.getWidth() - 5) : containerLocalXY[0];
				var containerYMax = eventLocalXY[1] + container.getHeight();
				containerLocalXY[1] = (containerYMax - mapSize[1] >= 0) ? eventLocalXY[1] - (containerYMax - mapSize[1]) : containerLocalXY[1];
				return containerLocalXY;
			}
		}
	});
});