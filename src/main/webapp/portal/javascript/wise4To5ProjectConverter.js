
// the global WISE5 project
var wise5Project = {};

// the global WISE4 project
var wise4Project = null;

// used to generate the node ids
var nodeCounter = 1;

// used to generate the group ids
var groupCounter = 0;

// used to generate the constraint ids
var constraintCounter = 0;

// the project file path
var projectFilePath = '';

// the project folder path
var projectFolderPath = '';

// holds the node ids of the previous node so that we can create transitions
var previousNodeIds = [];

// the node id of the branch point
var branchNodeId = '';

// holds the current group we are parsing so we can put child nodes into it
var currentGroup = null;

/**
 * Convert the WISE4 project into a WISE5 project
 */
function convert() {

    // create the WISE5 project object
    wise5Project = {};
    wise4Project = null;

    // initialize counters
    nodeCounter = 1;
    groupCounter = 0;
    constraintCounter = 0;

    // get the project path
    projectFilePath = $('#projectFilePathInput').val();

    // get the project folder path
    projectFolderPath = projectFilePath.substring(0, projectFilePath.lastIndexOf('/') + 1);

    // make a request for the WISE4 project file
    $.ajax({
        method: 'GET',
        url: projectFilePath
    }).done(function(response) {

        // get the WISE4 project
        wise4Project = response;

        // get the string representation of the WISE4 project
        var wise4ProjectString = JSON.stringify(wise4Project, null, 3);

        // display the WISE4 project string in the textarea
        $('#wise4ProjectFile').html(wise4ProjectString);

        // parse the WISE4 project to create the WISE5 project
        parseWISE4Project(wise4Project);
    });
};

/**
 * Parse the WISE4 project to create the WISE5 project
 * @param wise4Project the WISE4 project
 */
function parseWISE4Project(wise4Project) {

    // initialize the WISE5 project
    createWISE5Project();

    if (wise4Project != null) {

        // get the start point for the WISE4 project
        var startPoint = wise4Project.startPoint;

        // parse the WISE4 project
        parseWISE4ProjectHelper(wise4Project, startPoint);

        // set the title of the WISE5 project
        wise5Project.metadata.title = wise4Project.title;
    }

    // get the string representation of the WISE5 project
    var wise5ProjectString = JSON.stringify(wise5Project, null, 3);

    // display the WISE5 project string in the textarea
    $('#wise5ProjectFile').html(wise5ProjectString);

    // generate the project.json file that will be downloaded onto the user's computer
    generateProjectJSONFile('project.json', wise5ProjectString);
};

/**
 * Generate the project.json file and download it onto the user's computer
 * @param fileName the file name
 * @param stringContent the string content that will be placed in the file
 */
function generateProjectJSONFile(fileName, stringContent) {
    var a = document.createElement("a");
    var file = new Blob([stringContent], {type: 'text/plain'});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
};

/**
 * The helper function for parsing the WISE4 project
 * @param project the WISE4 project object
 * @param elementId the current WISE4 element id (aka node id)
 * @returns the WISE5 element (aka node or group) that has been created from the WISE4 element (aka node or group)
 */
function parseWISE4ProjectHelper(project, elementId) {

    var element = null;

    if (elementId != null) {

        // try to get the sequence with the given element id
        var sequence = getSequence(project, elementId);

        // try to get the node with the given element id
        var node = getNode(project, elementId);

        if (sequence != null) {
            // the element is a sequence

            if (isBranchingActivity(sequence)) {
                // the sequence is a branching activity

                // get the branch node id
                branchNodeId = previousNodeIds[0];

                // generate the branch in the WISE5 project
                handleBranchActivity(sequence);
            } else {
                // this is a regular sequence

                // create a WISE5 group
                var wise5Group = createWISE5Group(sequence);

                currentGroup = wise5Group;

                // add the group to the array of nodes
                addWISE5Node(wise5Group);

                // loop through all the children of the sequence
                for (var x = 0; x < sequence.refs.length; x++) {

                    // get a child id
                    var sequenceRefId = sequence.refs[x];

                    // get the child node
                    var childNode = parseWISE4ProjectHelper(project, sequenceRefId);

                    if (childNode != null) {
                        // add the child to the group
                        wise5Group.ids.push(childNode.id);

                        if (wise5Group.startId === '') {

                            // set the start id of the group if there currently is none
                            wise5Group.startId = childNode.id;
                        }
                    }
                }

                element = wise5Group;
            }
        } else if (node != null) {
            // the element is a node

            // create the WISE5 node
            element = createWISE5NodeFromNodeContent(node.identifier);

            // get the element id
            var elementId = element.id;

            if (previousNodeIds.length > 0) {

                /*
                 * loop through all the immediate previous node ids
                 *
                 * example 1
                 * (node1)--(node2)--(node3)
                 * if the current element is node3, the previousNodeIds would be [node2]
                 *
                 * example 2
                 * (node1)--(node2)--(node3)--(node5)
                 *                 \         /
                 *                  \       /
                 *                   (node4)
                 * if the current element is node5, the previousNodeIds would be [node3, node4]
                 */
                for (var p = 0; p < previousNodeIds.length; p++) {
                    var previousNodeId = previousNodeIds[p];

                    // add a transition from the previous node id to the new node
                    addTransition(previousNodeId, elementId);
                }

                // set the previous node id
                previousNodeIds = [elementId];
            } else {
                // there are no previous node ids

                // set the previous node id
                previousNodeIds = [elementId];
            }
        }
    }

    return element;
};

/**
 * Create a random id with 10 characters
 * @returns a random alphanumeric string
 */
function createRandomId() {
    var chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
        'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x',
        'y', 'z'];

    var result = '';

    var charCount = 10;

    for (var x = 0; x < charCount; x++) {

        // choose a random alphanumeric character
        var randomChar = chars[Math.floor(Math.random() * chars.length)];

        result += randomChar;
    }

    return result;
};

/**
 * Get the sequence from the project
 * @param project the project object
 * @param sequenceId the sequence id
 * @returns the sequence object
 */
function getSequence(project, sequenceId) {
    var sequence = null;

    if (project != null && sequenceId != null) {
        var sequences = project.sequences;

        // loop through all the sequences
        for (var s = 0; s < sequences.length; s++) {
            var tempSequence = sequences[s];

            if (tempSequence != null) {
                var identifier = tempSequence.identifier;

                if (sequenceId === identifier) {
                    // we have found the sequence we are looking for
                    sequence = tempSequence;
                    break;
                }
            }
        }
    }

    return sequence;
};

/**
 * Get the node from the project
 * @param project the project object
 * @param nodeId the node id
 * @returns the node object
 */
function getNode(project, nodeId) {
    var node = null;

    if (project != null && nodeId != null) {
        var nodes = project.nodes;

        // loop through all the nodes
        for (var n = 0; n < nodes.length; n++) {
            var tempNode = nodes[n];

            if (tempNode != null) {
                var identifier = tempNode.identifier;

                if (nodeId === identifier) {
                    // we have found the node we are looking for
                    node = tempNode;
                    break;
                }
            }
        }
    }

    return node;
};

/**
 * Create a WISE5 node from the WISE4 node content
 * @param identifier the WISE4 node id
 * @returns a WISE5 node
 */
function createWISE5NodeFromNodeContent(identifier) {

    var wise5Node = null;

    // get the path to the WISE4 node content file
    var nodeFilePath = projectFolderPath + identifier;

    $.ajax({
        method: 'GET',
        url: nodeFilePath,
        async: false,
        dataType: 'json'
    }).done(function(response) {

        // get the WISE4 node content
        var nodeContent = response;

        if (nodeContent != null) {

            // get the WISE4 node
            var node = getNode(wise4Project, identifier);

            // create the WISE5 node
            wise5Node = convertNode(node, nodeContent);
        }
    });

    return wise5Node;
};

/**
 * Convert a WISE4 node into a WISE5 node
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns the WISE5 node
 */
function convertNode(node, nodeContent) {

    var wise5Node = null;

    if (nodeContent != null) {
        var nodeType = nodeContent.type;

        if (nodeType === 'Html') {
            wise5Node = convertHTML(node, nodeContent);
        } else if (nodeType === 'AssessmentList') {
            wise5Node = convertAssessmentList(node, nodeContent);
        } else if (nodeType === 'OpenResponse') {
            wise5Node = convertOpenResponse(node, nodeContent);
        } else if (nodeType === 'Note') {

        } else if (nodeType === 'MultipleChoice' || nodeType === 'Challenge') {

        } else if (nodeType === 'MatchSequence') {

        } else if (nodeType === 'SVGDraw') {
            wise5Node = convertDraw(node, nodeContent);
        } else if (nodeType === 'Brainstorm') {
            wise5Node = convertBrainstorm(node, nodeContent);
        } else if (nodeType === 'Fillin') {

        } else if (nodeType === 'Sensor') {

        } else if (nodeType === 'Table') {
            wise5Node = convertTable(node, nodeContent);
        } else if (nodeType === 'IdeaBasket') {

        } else if (nodeType === 'ExplanationBuilder') {

        } else if (nodeType === 'OutsideUrl') {

        } else if (nodeType === 'Mysystem2') {

        } else if (nodeType === 'Annotator') {
            wise5Node = convertAnnotator(node, nodeContent);
        } else if (nodeType === 'Branching') {

        } else if (nodeType === 'PhET') {
            wise5Node = convertPhet(node, nodeContent);
        }
    }

    if (wise5Node != null) {
        //console.log(nodeType + '[x]');
    }

    return wise5Node;
};

/**
 * Create and initialize the WISE5 project object
 */
function createWISE5Project() {
    wise5Project.nodes = [];
    wise5Project.constraints = [];
    wise5Project.startGroupId = 'group0';
    wise5Project.startNodeId = 'node1';

    wise5Project.navigationMode = 'guided';
    wise5Project.navigationApplications = [
        'wiseMap',
        'wiseList'
    ];

    wise5Project.layout = {
        'template': 'starmap|leftNav|rightNav',
        'studentIsOnGroupNode': 'layout3',
        'studentIsOnApplicationNode': 'layout4'
    }

    var metadata = {};
    metadata.title = '';
    wise5Project.metadata = metadata;
};

/**
 * Create and initialize a WISE5 group object
 * @param sequence the WISE4 sequence
 * @returns a WISE5 group object
 */
function createWISE5Group(sequence) {
    var wise5Group = {};
    wise5Group.id = getNextGroupId();
    wise5Group.type = 'group';
    wise5Group.title = sequence.title;
    wise5Group.startId = '';
    wise5Group.ids = [];

    return wise5Group;
};

/**
 * Create and initialize a WISE5 node object
 * @returns a WISE5 node object
 */
function createWISE5Node() {
    var wise5Node = {};

    wise5Node.id = getNextNodeId();
    wise5Node.type = 'node';
    wise5Node.showSaveButton = true;
    wise5Node.showSubmitButton = true;
    wise5Node.constraints = [];

    var transitionLogic = {};
    transitionLogic.transitions = [];
    transitionLogic.howToChooseAmongAvailablePaths = null;
    transitionLogic.whenToChoosePath = null;
    transitionLogic.canChangePath = null;
    transitionLogic.maxPathsVisitable = null;

    wise5Node.transitionLogic = transitionLogic;

    return wise5Node;
};

/**
 * Convert a WISE4 html node into a WISE5 node with an html component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertHTML(node, nodeContent) {

    var wise5Node = null;

    if (nodeContent != null) {

        // get the path to the WISE4 html file
        var src = projectFolderPath + nodeContent.src;

        $.ajax({
            method: 'GET',
            url: src,
            async: false,
            dataType: 'html'
        }).done(function(response) {

            // get the html
            var html = response;

            if (html != null) {

                // create a WISE5 node
                wise5Node = createWISE5Node();

                // set the title
                wise5Node.title = node.title;

                // set the prompt
                var content = {};
                content.prompt = nodeContent.prompt;
                content.components = [];

                var component = {};

                // set the component id
                component.id = createRandomId();
                component.componentType = 'HTML';

                // set the html
                component.html = html;

                // add the component
                content.components.push(component);

                // set the content
                wise5Node.content = content;

                // add the WISE5 node to the project
                addWISE5Node(wise5Node);
            }
        });
    }

    return wise5Node;
};

/**
 * Convert a WISE4 assessment list node into a WISE5 node with
 * open response and multiple choice components
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertAssessmentList(node, nodeContent) {

    // create a WISE5 node
    var wise5Node = createWISE5Node();

    // set the title
    wise5Node.title = node.title;

    var prompt = nodeContent.prompt;

    //console.log(prompt);

    var content = {};
    // set the prompt
    content.prompt = nodeContent.prompt;
    content.components = [];

    // get all the assessment parts
    var assessments = nodeContent.assessments;

    if (assessments != null) {

        // loop through all the assessment parts
        for (var a = 0; a < assessments.length; a++) {

            // get an assessment part
            var assessment = assessments[a];

            if (assessment != null) {
                var component = {};

                // set the component id
                component.id = createRandomId();

                // set the prompt
                component.prompt = assessment.prompt;

                if (assessment.type === 'text') {
                    // create an open response component
                    component.componentType = 'OpenResponse';
                } else if (assessment.type === 'radio' || assessment.type === 'checkbox') {
                    // create an multiple choice component
                    component.componentType = 'MultipleChoice';

                    // get all the choices
                    var choices = assessment.choices;

                    component.choices = [];

                    // loop through all the choices
                    for (var c = 0; c < choices.length; c++) {
                        var tempChoice = choices[c];

                        if (tempChoice != null) {
                            var tempText = tempChoice.text;
                            var choiceId = createRandomId();

                            // create the choice object
                            var choice = {};
                            choice.id = choiceId;
                            choice.text = tempText;
                            choice.feedback = '';

                            component.choices.push(choice);

                            if (tempChoice.isCorrect) {
                                // this choice is the correct choice
                                component.correctChoice = choiceId;
                            }
                        }
                    }
                }

                content.components.push(component);
            }
        }
    }

    // set the content into the WISE5 node
    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert a WISE4 open response node into a WISE5 node with an open response component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertOpenResponse(node, nodeContent) {

    // create a WISE5 node
    var wise5Node = createWISE5Node();

    // set the title
    wise5Node.title = node.title;

    var prompt = nodeContent.prompt;

    //console.log(prompt);

    var content = {};
    content.components = [];

    var component = {};

    // set the component id
    component.id = createRandomId();

    component.componentType = 'OpenResponse';
    component.prompt = nodeContent.prompt;

    content.components.push(component);

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert a WISE4 table node into a WISE5 node with a table component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertTable(node, nodeContent) {

    // create a WISE5 node
    var wise5Node = createWISE5Node();

    // set the title
    wise5Node.title = node.title;

    var content = {};

    content.components = [];

    var tableComponent = {};

    // set the component id
    tableComponent.id = createRandomId();
    tableComponent.componentType = 'Table';
    tableComponent.prompt = nodeContent.prompt;
    tableComponent.globalCellSize = nodeContent.globalCellSize;

    // convert the WISE4 table to a WISE5 table
    var newTableData = convertTableData(nodeContent.tableData);
    tableComponent.tableData = newTableData;

    content.components.push(tableComponent);

    if (!nodeContent.hideEverythingBelowTable) {
        /*
         * if the WISE4 node has a textarea below the table we will
         * create an open response component
         */

        var openResponseComponent = {};

        openResponseComponent.id = createRandomId();
        openResponseComponent.componentType = 'OpenResponse';
        openResponseComponent.prompt = nodeContent.prompt2;

        content.components.push(openResponseComponent);
    }

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert the WISE4 table data into WISE5 table data
 * @param tableData the WISE4 table data from a table step
 * @returns the table data for a WISE5 table component
 */
function convertTableData(tableData) {
    var newTableData = [];

    if (tableData != null) {

        // loop through all the rows
        for (var y = 0; y < tableData.length; y ++) {
            var row = tableData[y];

            var newRow = [];

            if (row != null) {

                // loop through all the cells in the row
                for (var x = 0; x < row.length; x++) {
                    var cell = row[x];

                    if (cell != null) {
                        var newCell = {};

                        newCell.text = cell.text;
                        newCell.editable = !cell.uneditable;
                        newCell.size = parseInt(cell.cellSize);

                        newRow.push(newCell);
                    }
                }
            }

            newTableData.push(newRow);
        }
    }

    return newTableData;
};

/**
 * Convert the WISE4 Phet node into a WISE5 node with an outside url component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertPhet(node, nodeContent) {
    var wise5Node = createWISE5Node();

    wise5Node.title = node.title;

    var content = {};

    content.components = [];

    var component = {};

    component.id = createRandomId();
    component.componentType = 'OutsideURL';

    // set the url for the Phet model
    component.url = nodeContent.url;

    content.components.push(component);

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert a WISE4 draw node into a WISE5 node with a draw component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertDraw(node, nodeContent) {
    var wise5Node = createWISE5Node();
    wise5Node.title = node.title;

    var content = {};
    content.components = [];

    var component = {};
    component.id = createRandomId();
    component.componentType = 'Draw';
    component.prompt = nodeContent.prompt;

    content.components.push(component);

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert a WISE4 brainstorm node into a WISE5 node with a discussion component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertBrainstorm(node, nodeContent) {
    var wise5Node = createWISE5Node();
    wise5Node.title = node.title;

    var content = {};
    content.components = [];

    var component = {};
    component.id = createRandomId();
    component.componentType = 'Discussion';

    var prompt = '';

    if (nodeContent.assessmentItem != null &&
        nodeContent.assessmentItem.interaction != null &&
        nodeContent.assessmentItem.interaction.prompt != null) {

        // get the prompt
        prompt = nodeContent.assessmentItem.interaction.prompt
    }

    component.prompt = prompt;

    content.components.push(component);

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Convert a WISE4 annotator node into a WISE5 node with an html component
 * @param node the WISE4 node
 * @param nodeContent the WISE4 node content
 * @returns a WISE5 node
 */
function convertAnnotator(node, nodeContent) {
    var wise5Node = createWISE5Node();
    wise5Node.title = node.title;

    var content = {};
    content.components = [];

    var component = {};
    component.id = createRandomId();
    component.componentType = 'HTML';
    component.html = 'Insert Annotator component here';
    component.prompt = nodeContent.prompt;

    content.components.push(component);

    wise5Node.content = content;

    // add the WISE5 node to the project
    addWISE5Node(wise5Node);

    return wise5Node;
};

/**
 * Get the next node id that is available
 * @returns a node id string
 */
function getNextNodeId() {
    var nodeId = 'node' + nodeCounter;

    nodeCounter++;

    return nodeId;
};

/**
 * Get the next group id that is available
 * @returns a group id string
 */
function getNextGroupId() {
    var groupId = 'group' + groupCounter;

    groupCounter++;

    return groupId;
};

/**
 * Add a WISE5 node to the WISE5 project
 * @param wise5Node the WISE5 node
 */
function addWISE5Node(wise5Node) {
    wise5Project.nodes.push(wise5Node);
};

/**
 * Add a transition
 * @param fromNodeId the from node id
 * @param toNodeId the to node id
 * @param criteriaArray (optional) the criteria that needs to be satisifed
 * in order for the student to be able to traverse this transition
 */
function addTransition(fromNodeId, toNodeId, criteriaArray) {

    // get the from node
    var node = getWISE5NodeById(fromNodeId);

    if (node != null) {
        var transitionLogic = node.transitionLogic;

        if (transitionLogic != null) {
            var transitions = transitionLogic.transitions;

            if (transitions != null) {

                // create the transition object
                var transitionObject = {};
                transitionObject.to = toNodeId;

                if (criteriaArray != null) {
                    transitionObject.criteria = criteriaArray;
                }

                // add the transition
                transitions.push(transitionObject);
            }
        }
    }

};

/**
 * Get a WISE5 node by id
 * @param nodeId the node id
 * @returns the WISE5 node
 */
function getWISE5NodeById(nodeId) {
    var node = null;

    if (nodeId != null) {
        var nodes = wise5Project.nodes;

        // loop through all the WISE5 nodes currently in the WISE5 project
        for (var n = 0; n < nodes.length; n++) {
            var tempNode = nodes[n];

            if (tempNode != null) {
                var tempNodeId = tempNode.id;

                if (nodeId === tempNodeId) {
                    // we have found the node id that we want
                    node = tempNode;
                    break;
                }
            }
        }
    }

    return node;
};

/**
 * Check if the WISE4 sequence is a branching activity
 * @param sequence the WISE4 sequence
 * @returns whether the sequence is a branching activity
 */
function isBranchingActivity(sequence) {
    var result = false;

    if (sequence != null) {
        var refs = sequence.refs;

        // regex to that matches strings that end with br
        var regex = /.*br$/;

        if (refs != null && refs.length > 0) {
            var firstRef = refs[0];

            /*
             * check if the first node in the branch is a branching node
             * by checking if the node id ends with br
             */
            if (firstRef.match(regex)) {
                result = true;
            }
        }
    }

    return result;
};

/**
 * Create a WISE5 branch from the WISE4 branch
 * @param sequence the WISE4 branch sequence
 */
function handleBranchActivity(sequence) {

    if (sequence != null) {

        // get all the children of the sequence
        var refs = sequence.refs;

        var branchNode = null;

        var lastNodeIds = [];

        // loop through all the children
        for (var r = 0; r < refs.length; r++) {
            var ref = refs[r];

            if (r === 0) {
                // the first child should be a branch node
                branchNode = getBranchNode(ref);
            } else {

                /*
                 * all the children that are not the first child should be
                 * branch sequences
                 */

                // create the WISE5 nodes in this branch path
                var branchNodes = getWISE5NodesInBranchPath(ref);

                // remember the previous node ids so that we can create transitions later
                var tempPreviousNodeIds = previousNodeIds;

                var firstNodeIdInBranch = null;

                // loop through all the nodes in the branch path
                for (var b = 0; b < branchNodes.length; b++) {

                    // get a WISE5 node
                    var wise5Node = branchNodes[b];

                    var to = wise5Node.id;

                    // add the WISE5 node to the current group
                    currentGroup.ids.push(wise5Node.id);

                    if (b === 0) {
                        /*
                         * this is the first node in the branch path so we will remember it so we can
                         * create a transition later
                         */
                        firstNodeIdInBranch = wise5Node.id;
                    }

                    // loop through all the previous node ids
                    for (var p = 0; p < tempPreviousNodeIds.length; p++) {

                        // get a previous node id
                        var tempPreviousNodeId = tempPreviousNodeIds[p];

                        // get the previous node
                        var previousWISE5Node = getWISE5NodeById(tempPreviousNodeId);

                        // create a transition
                        addTransition(tempPreviousNodeId, to);

                        if (b === 0) {
                            // this is the first node in the branch path

                            /*
                             * get the transition logic from the previous node.
                             * the previous node is the branch point.
                             */
                            var transitionLogic = previousWISE5Node.transitionLogic;

                            // get the branching function
                            var branchingFunction = branchNode.branchingFunction;
                            var maxPathVisitable = branchNode.maxPathVisitable;

                            // set how to choose the path
                            transitionLogic.howToChooseAmongAvailablePaths = branchingFunction;
                            transitionLogic.whenToChoosePath = 'enterNode';

                            // set whether the student can change path
                            if (maxPathVisitable > 1) {
                                transitionLogic.canChangePath = true;
                            } else {
                                transitionLogic.canChangePath = false;
                            }

                            // set the max visitable paths
                            transitionLogic.maxPathsVisitable = maxPathVisitable;
                        }

                        /*
                         * loop through all the previous node ids. usually there will only be
                         * one previous node id and it will be the branch point.
                         *
                         * create constraints that make the nodes in the branch path not visible
                         * and not visitable until the student takes the path.
                         */
                        for (var x = 0; x < previousNodeIds.length; x++) {
                            // get the branch point node id
                            var branchPointNodeId = previousNodeIds[x];

                            // create a constraint that makes the node not visible
                            var notVisibleBranchConstraint = this.createBranchConstraint('makeThisNodeNotVisible', branchPointNodeId, firstNodeIdInBranch, to);

                            // create a constraint that makes the node not visitable
                            var notVisitableBranchConstraint = this.createBranchConstraint('makeThisNodeNotVisitable', branchPointNodeId, firstNodeIdInBranch, to);

                            // add the constraints
                            this.addWISE5Constraint(to, notVisibleBranchConstraint);
                            this.addWISE5Constraint(to, notVisitableBranchConstraint);
                        }
                    }

                    // update the previous node ids
                    tempPreviousNodeIds = [to];

                    if (b === (branchNodes.length - 1)) {
                        // remember the last node in the branch path so we can set it into the previousNodeIds later
                        lastNodeIds.push(wise5Node.id);
                    }
                }
            }
        }

        previousNodeIds = lastNodeIds;
    }
};

/**
 * Create a branch path taken constraint
 * @param constraintAction the constraint action
 * @param fromNodeId the from node id
 * @param toNodeId the to node id
 * @param targetNodeId the node id to constrain
 * @returns the constraint object
 */
function createBranchConstraint(constraintAction, fromNodeId, toNodeId, targetNodeId) {
    var branchConstraint = null;

    if (fromNodeId != null && toNodeId != null && targetNodeId != null) {

        // create the constraint action
        branchConstraint = {};
        branchConstraint.id = 'constraint' + constraintCounter;
        branchConstraint.action = constraintAction;
        branchConstraint.targetId = targetNodeId;
        branchConstraint.removalCriteria = [];

        constraintCounter++;

        // create the critera that needs to be satisfied in order to remove the constraint
        var criteria = {};
        criteria.functionName = 'branchPathTaken';
        criteria.fromNodeId = fromNodeId;
        criteria.toNodeId = toNodeId;
        branchConstraint.removalCriteria.push(criteria);
    }

    return branchConstraint;
};

/**
 * Add the WISE5 constraint
 * @param nodeId the node id
 * @param constraint the constraint object
 */
function addWISE5Constraint(nodeId, constraint) {

    var node = getWISE5NodeById(nodeId);

    if (node != null) {
        node.constraints.push(constraint);
    }
};

/**
 * Get the WISE4 branch node
 * @param nodeId the WISE4 node id
 * @returns the WISE4 branch node content
 */
function getBranchNode(nodeId) {
    var nodeFilePath = projectFolderPath + nodeId;

    var nodeContent = '';

    $.ajax({
        method: 'GET',
        url: nodeFilePath,
        async: false,
        dataType: 'json'
    }).done(function(response) {
        nodeContent = response;
    });

    return nodeContent;
};

/**
 * Get the WISE5 nodes in the branch path
 * @param sequenceId the WISE4 sequence id
 * @returns an array of WISE5 nodes that are in the branch path
 */
function getWISE5NodesInBranchPath(sequenceId) {

    var branchNodes = [];

    if (wise4Project != null && sequenceId != null) {

        // get the WISE4 sequence
        var sequence = getSequence(wise4Project, sequenceId);

        if (sequence != null) {
            var refs = sequence.refs;

            if (refs != null) {

                // loop through all the nodes in the sequence
                for (var r = 0; r < refs.length; r++) {
                    var ref = refs[r];

                    // create a WISE5 node
                    var wise5Node = createWISE5NodeFromNodeContent(ref);

                    branchNodes.push(wise5Node);
                }
            }
        }
    }

    return branchNodes;
};

function fixAssetReferences(html) {

    var fixedHTML = '';



    return fixedHTML;
};