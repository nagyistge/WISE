var coreScripts = [
	'vle/node/sensor/SensorNode.js',
	'vle/node/sensor/sensorEvents.js'
];

var studentVLEScripts = [
	'vle/node/sensor/sensor.js',
	'vle/node/sensor/sensorstate.js',
	'vle/lib/jquery/js/flot/excanvas.js',
	'vle/lib/jquery/js/flot/jquery.js',
    'vle/lib/jquery/js/flot/jquery.flot.js',
    'vle/node/sensor/sensor-applet-interface.js',
];

var authorScripts = [
	'vle/node/sensor/authorview_sensor.js'
];

var gradingScripts = [
	'vle/node/sensor/sensorstate.js',
	'vle/node/sensor/sensor.js',
	'vle/lib/jquery/js/flot/jquery.flot.js'
];


var dependencies = [
	{child:"vle/node/sensor/SensorNode.js", parent:["vle/node/Node.js"]},
	{child:"vle/lib/jquery/js/flot/jquery.flot.js", parent:["vle/lib/jquery/js/flot/jquery.js"]}
];

var css = [
       	
];

var nodeClasses = [
	{nodeClass:'simulation', nodeClassText:'Sensor', icon:'node/sensor/icons/simulation28.png'}
];

var nodeIconPath = 'node/sensor/icons/';
componentloader.addNodeIconPath('SensorNode', nodeIconPath);

scriptloader.addScriptToComponent('core', coreScripts);
scriptloader.addScriptToComponent('sensor', studentVLEScripts);
scriptloader.addScriptToComponent('author', authorScripts);
scriptloader.addScriptToComponent('studentwork', gradingScripts);
scriptloader.addDependencies(dependencies);
scriptloader.addCssToComponent('sensor', css);

var topMenuScripts = [
	'vle/node/sensor/sensor.js',
	'vle/node/sensor/sensorstate.js',
	'vle/lib/jquery/js/flot/jquery.flot.js'
];

scriptloader.addScriptToComponent('topMenu', topMenuScripts);

componentloader.addNodeClasses('SensorNode', nodeClasses);

var nodeTemplateParams = [
	{
		nodeTemplateFilePath:'node/sensor/sensorTemplate.se',
		nodeExtension:'se'
	}
];

componentloader.addNodeTemplateParams('SensorNode', nodeTemplateParams);

//used to notify scriptloader that this script has finished loading
if(typeof eventManager != 'undefined'){
	eventManager.fire('scriptLoaded', 'vle/node/sensor/setup.js');
};