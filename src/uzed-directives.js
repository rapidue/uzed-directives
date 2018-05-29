(function() {
    'use strict';
    var appDir = angular.module('uzed-directives', []);

    /*Lazy image placeholder show*/

    appDir.directive('hires', function() {
        return {
            restrict: 'A',
            scope: { hires: '@' },
            /*replace : true,
            template : "<ion-spinner icon='spiral' class='spinner-15'></ion-spinner>",*/
            link: function(scope, element, attrs) {
                var initialLoad = false;
                element.bind('load', function() {
                    initialLoad = true;
                    if(!scope.hires) return;
                    var ext = scope.hires.substring(scope.hires.lastIndexOf(".")+1);
                    var fileName = + ext;
                    if(ext=='pdf'){
                        element.addClass('complete');
                        element.attr('src', './img/my-stuff/pdf-icon.png');
                    } else {
                        element.addClass('complete');
                        element.attr('src', scope.hires);
                    }
                });

                element.bind('error', function() {
                    if (attrs.src != attrs.src) {
                        attrs.$set('src', attrs.src);
                    }
                });

                attrs.$observe('hires', function(value) {
                    if(!value) return;
                    element.addClass('loader');
                    if(initialLoad) element.attr('src', value);
                });
            }
        };
    });
    appDir.directive('onErrorSrc', function() {
        return {
            link: function(scope, element, attrs) {
                element.bind('error', function() {
                    if (attrs.src != attrs.onErrorSrc) {
                        attrs.$set('src', attrs.onErrorSrc);
                    }
                });
            }
        };
    });
    appDir.directive('uiMask', [
        function () {
            var maskDefinitions = {
                '9': /\d/,
                'A': /[a-zA-Z]/,
                '*': /[a-zA-Z0-9]/
            };
            return {
                priority: 100,
                require: 'ngModel',
                restrict: 'A',
                link: function (scope, iElement, iAttrs, controller) {
                    //console.log('init');
                    var viewValue;
                    var maskProcessed = false, eventsBound = false,
                        maskCaretMap, maskPatterns, maskPlaceholder, maskComponents,
                        validValue,
                        // Minimum required length of the value to be considered valid
                        minRequiredLength,
                        value, valueMasked, isValid,
                        // Vars for initializing/uninitializing
                        originalPlaceholder = iAttrs.placeholder,
                        originalMaxlength   = iAttrs.maxlength,
                        // Vars used exclusively in eventHandler()
                        oldValue, oldValueUnmasked, oldCaretPosition, oldSelectionLength;

                    function initialize(maskAttr) {
                        if (!angular.isDefined(maskAttr)){
                            return uninitialize();
                        }
                        processRawMask(maskAttr);
                        if (!maskProcessed){
                            return uninitialize();
                        }
                        initializeElement();
                        bindEventListeners();
                    }

                    function formatter(fromModelValue) {
                        if (!maskProcessed){
                            return fromModelValue;
                        }
                        value   = unmaskValue(fromModelValue || '');
                        isValid = validateValue(value);
                        controller.$setValidity('mask', isValid);

                        if (isValid) validValue = value;
                        //console.log('formatter valid:'+validValue);
                        return isValid && value.length ? maskValue(value) : undefined;
                    }


                    function parser(fromViewValue) {
                        if (!maskProcessed){
                            return fromViewValue;
                        }
                        value     = unmaskValue(fromViewValue || '');
                        isValid   = validateValue(value);
                        viewValue = value.length ? maskValue(value) : '';
                        // We have to set viewValue manually as the reformatting of the input
                        // value performed by eventHandler() doesn't happen until after
                        // this parser is called, which causes what the user sees in the input
                        // to be out-of-sync with what the controller's $viewValue is set to.
                        controller.$viewValue = viewValue;
                        controller.$setValidity('mask', isValid);
                        if (value === '' && controller.$error.required !== undefined){
                            controller.$setValidity('required', false);
                        }
                        if (isValid) validValue = value;
                        //console.log('parser valid:'+validValue);
                        return isValid ? value : undefined;
                    }

                    iAttrs.$observe('uiMask', initialize);
                    controller.$formatters.push(formatter);
                    controller.$parsers.push(parser);

                    function uninitialize() {
                        maskProcessed = false;
                        unbindEventListeners();

                        if (angular.isDefined(originalPlaceholder)){
                            iElement.attr('placeholder', originalPlaceholder);
                        }else{
                            iElement.removeAttr('placeholder');
                        }

                        if (angular.isDefined(originalMaxlength)){
                            iElement.attr('maxlength', originalMaxlength);
                        }else{
                            iElement.removeAttr('maxlength');
                        }

                        iElement.val(controller.$modelValue);
                        controller.$viewValue = controller.$modelValue;
                        return false;
                    }

                    function initializeElement() {
                        value       = oldValueUnmasked = unmaskValue(controller.$modelValue || '');
                        valueMasked = oldValue         = maskValue(value);
                        isValid     = validateValue(value);
                        viewValue   = isValid && value.length ? valueMasked : '';
                        if (iAttrs.maxlength){ // Double maxlength to allow pasting new val at end of mask
                            iElement.attr('maxlength', maskCaretMap[maskCaretMap.length-1]*2);
                        }
                        iElement.attr('placeholder', maskPlaceholder);
                        iElement.val(viewValue);
                        controller.$viewValue = viewValue;
                        // Not using $setViewValue so we don't clobber the model value and dirty the form
                        // without any kind of user interaction.
                    }

                    function bindEventListeners() {
                        if (eventsBound){
                            return true;
                        }
                        iElement.bind('blur',              blurHandler);
                        iElement.bind('mousedown mouseup', mouseDownUpHandler);
                        iElement.bind('input keyup click', eventHandler);
                        eventsBound = true;
                    }

                    function unbindEventListeners() {
                        if (!eventsBound){
                            return true;
                        }
                        iElement.unbind('blur',      blurHandler);
                        iElement.unbind('mousedown', mouseDownUpHandler);
                        iElement.unbind('mouseup',   mouseDownUpHandler);
                        iElement.unbind('input',     eventHandler);
                        iElement.unbind('keyup',     eventHandler);
                        iElement.unbind('click',     eventHandler);
                        eventsBound = false;
                    }

                    function validateValue(value) {
                        // Zero-length value validity is ngRequired's determination
                        return value.length ? value.length >= minRequiredLength : true;
                    }

                    function unmaskValue(value) {
                        var valueUnmasked    = '',
                            maskPatternsCopy = maskPatterns.slice();
                        // Preprocess by stripping mask components from value
                        value = value.toString();
                        angular.forEach(maskComponents, function(component, i) {
                            value = value.replace(component, '');
                        });
                        angular.forEach(value.split(''), function(chr, i) {
                            if (maskPatternsCopy.length && maskPatternsCopy[0].test(chr)) {
                                valueUnmasked += chr;
                                maskPatternsCopy.shift();
                            }
                        });
                        return valueUnmasked;
                    }

                    function maskValue(unmaskedValue) {
                        var valueMasked      = '',
                            maskCaretMapCopy = maskCaretMap.slice();
                        angular.forEach(maskPlaceholder.split(''), function(chr, i) {
                            if (unmaskedValue.length && i === maskCaretMapCopy[0]) {
                                valueMasked  += unmaskedValue.charAt(0) || '_';
                                unmaskedValue = unmaskedValue.substr(1);
                                maskCaretMapCopy.shift(); }
                            else{
                                valueMasked += chr;
                            }
                        });
                        return valueMasked;
                    }

                    function processRawMask(mask) {
                        var characterCount = 0;
                        maskCaretMap       = [];
                        maskPatterns       = [];
                        maskPlaceholder    = '';

                        // No complex mask support for now...
                        // if (mask instanceof Array) {
                        //   angular.forEach(mask, function(item, i) {
                        //     if (item instanceof RegExp) {
                        //       maskCaretMap.push(characterCount++);
                        //       maskPlaceholder += '_';
                        //       maskPatterns.push(item);
                        //     }
                        //     else if (typeof item == 'string') {
                        //       angular.forEach(item.split(''), function(chr, i) {
                        //         maskPlaceholder += chr;
                        //         characterCount++;
                        //       });
                        //     }
                        //   });
                        // }
                        // Otherwise it's a simple mask
                        // else

                        if (typeof mask === 'string') {
                            minRequiredLength = 0;
                            var isOptional = false;

                            angular.forEach(mask.split(''), function(chr, i) {
                                if (maskDefinitions[chr]) {
                                    maskCaretMap.push(characterCount);
                                    maskPlaceholder += originalPlaceholder ? originalPlaceholder : ' ';
                                    maskPatterns.push(maskDefinitions[chr]);

                                    characterCount++;
                                    if (!isOptional) {
                                        minRequiredLength++;
                                    }
                                }
                                else if (chr === "?") {
                                    isOptional = true;
                                }
                                else{
                                    maskPlaceholder += chr;
                                    characterCount++;
                                }
                            });
                        }
                        // Caret position immediately following last position is valid.
                        maskCaretMap.push(maskCaretMap.slice().pop() + 1);
                        // Generate array of mask components that will be stripped from a masked value
                        // before processing to prevent mask components from being added to the unmasked value.
                        // E.g., a mask pattern of '+7 9999' won't have the 7 bleed into the unmasked value.
                        // If a maskable char is followed by a mask char and has a mask
                        // char behind it, we'll split it into it's own component so if
                        // a user is aggressively deleting in the input and a char ahead
                        // of the maskable char gets deleted, we'll still be able to strip
                        // it in the unmaskValue() preprocessing.
                        maskComponents = maskPlaceholder.replace(/[_]+/g,'_').replace(/([^_]+)([a-zA-Z0-9])([^_])/g, '$1$2_$3').split('_');
                        maskProcessed  = maskCaretMap.length > 1 ? true : false;
                    }

                    function blurHandler(e) {
                        oldCaretPosition   = 0;
                        oldSelectionLength = 0;
                        /*if (!isValid || value.length === 0) {
                          valueMasked = '';
                          iElement.val('');
                          scope.$apply(function() {
                            controller.$setViewValue('');
                          });
                        }*/
                    }

                    function mouseDownUpHandler(e) {
                        if (e.type === 'mousedown'){
                            iElement.bind('mouseout', mouseoutHandler);
                        }else{
                            iElement.unbind('mouseout', mouseoutHandler);
                        }
                    }

                    iElement.bind('mousedown mouseup', mouseDownUpHandler);

                    function mouseoutHandler(e) {
                        oldSelectionLength = getSelectionLength(this);
                        iElement.unbind('mouseout', mouseoutHandler);
                    }

                    function eventHandler(e) {
                        e = e || {};
                        // Allows more efficient minification
                        var eventWhich = e.which,
                            eventType  = e.type;
                        // Prevent shift and ctrl from mucking with old values
                        if (eventWhich === 16 || eventWhich === 91){ return true;}

                        var val             = iElement.val(),
                            valOld          = oldValue,
                            valMasked,
                            valUnmasked     = unmaskValue(val),
                            valUnmaskedOld  = oldValueUnmasked,
                            valAltered      = false,

                            caretPos        = getCaretPosition(this) || 0,
                            caretPosOld     = oldCaretPosition || 0,
                            caretPosDelta   = caretPos - caretPosOld,
                            caretPosMin     = maskCaretMap[0],
                            caretPosMax     = maskCaretMap[valUnmasked.length] || maskCaretMap.slice().shift(),

                            selectionLen    = getSelectionLength(this),
                            selectionLenOld = oldSelectionLength || 0,
                            isSelected      = selectionLen > 0,
                            wasSelected     = selectionLenOld > 0,

                            // Case: Typing a character to overwrite a selection
                            isAddition      = (val.length > valOld.length) || (selectionLenOld && val.length >  valOld.length - selectionLenOld),
                            // Case: Delete and backspace behave identically on a selection
                            isDeletion      = (val.length < valOld.length) || (selectionLenOld && val.length === valOld.length - selectionLenOld),
                            isSelection     = (eventWhich >= 37 && eventWhich <= 40) && e.shiftKey, // Arrow key codes

                            isKeyLeftArrow  = eventWhich === 37,
                            // Necessary due to "input" event not providing a key code
                            isKeyBackspace  = eventWhich === 8  || (eventType !== 'keyup' && isDeletion && (caretPosDelta === -1)),
                            isKeyDelete     = eventWhich === 46 || (eventType !== 'keyup' && isDeletion && (caretPosDelta === 0 ) && !wasSelected),

                            // Handles cases where caret is moved and placed in front of invalid maskCaretMap position. Logic below
                            // ensures that, on click or leftward caret placement, caret is moved leftward until directly right of
                            // non-mask character. Also applied to click since users are (arguably) more likely to backspace
                            // a character when clicking within a filled input.
                            caretBumpBack   = (isKeyLeftArrow || isKeyBackspace || eventType === 'click') && caretPos > caretPosMin;

                        oldSelectionLength  = selectionLen;

                        // These events don't require any action
                        if (isSelection || (isSelected && (eventType === 'click' || eventType === 'keyup'))){
                            return true;
                        }

                        // Value Handling
                        // ==============

                        // User attempted to delete but raw value was unaffected--correct this grievous offense

                        if ((eventType === 'input') && isDeletion && !wasSelected && valUnmasked === valUnmaskedOld) {
                            console.log("Value HandlingAAAAAAAAAAAAAAAAAAAA!!!!");
                            while (isKeyBackspace && caretPos > caretPosMin && !isValidCaretPosition(caretPos)){
                                caretPos--;
                            }
                            while (isKeyDelete && caretPos < caretPosMax && maskCaretMap.indexOf(caretPos) === -1){
                                caretPos++;
                            }
                            var charIndex = maskCaretMap.indexOf(caretPos);
                            // Strip out non-mask character that user would have deleted if mask hadn't been in the way.
                            valUnmasked = valUnmasked.substring(0, charIndex) + valUnmasked.substring(charIndex + 1);
                            valAltered  = true;
                        }

                        if(window.cordova && (valUnmasked.length === minRequiredLength || valUnmasked.length ===originalMaxlength) && ionic.Platform.isAndroid() ){
                            cordova.plugins.Keyboard.close();

                        }
                        // Update values
                        // console.log(e);
                        // console.log("Sandy", valUnmasked.length);
                        // console.log(String.fromCharCode(e.keyCode));
                        //console.log(String.fromCodePoint(e.keyCode));
                        //console.log("---> update values start");
                        //console.log("valUnmasked:" + valUnmasked);
                        //console.log("valMasked:" + valMasked);
                        valMasked        = maskValue(valUnmasked);
                        oldValue         = valMasked;
                        oldValueUnmasked = valUnmasked;
                        iElement.val(valMasked);
                        if (valAltered) {
                            //console.log("value was altered");
                            //console.log("apply:" + valUnmasked);
                            // We've altered the raw value after it's been $digest'ed, we need to $apply the new value.
                            scope.$apply(function() {
                                controller.$setViewValue(valUnmasked);
                            });
                        }
                        //console.log("<--- update values end");
                        // Caret Repositioning
                        // ===================

                        // Ensure that typing always places caret ahead of typed character in cases where the first char of
                        // the input is a mask char and the caret is placed at the 0 position.
                        if (isAddition && (caretPos <= caretPosMin)){
                            caretPos = caretPosMin + 1;
                        }

                        if (caretBumpBack){
                            caretPos--;
                        }

                        // Make sure caret is within min and max position limits
                        caretPos = caretPos > caretPosMax ? caretPosMax : caretPos < caretPosMin ? caretPosMin : caretPos;

                        // Scoot the caret back or forth until it's in a non-mask position and within min/max position limits
                        while (!isValidCaretPosition(caretPos) && caretPos > caretPosMin && caretPos < caretPosMax){
                            caretPos += caretBumpBack ? -1 : 1;
                        }

                        if ((caretBumpBack && caretPos < caretPosMax) || (isAddition && !isValidCaretPosition(caretPosOld))){
                            caretPos++;
                        }
                        oldCaretPosition = caretPos;
                        setCaretPosition(this, caretPos);
                    }

                    function isValidCaretPosition(pos) { return maskCaretMap.indexOf(pos) > -1; }

                    function getCaretPosition(input) {
                        if (input.selectionStart !== undefined){
                            return input.selectionStart;
                        }else if (document.selection) {
                            // Curse you IE
                            input.focus();
                            var selection = document.selection.createRange();
                            selection.moveStart('character', -input.value.length);
                            return selection.text.length;
                        }
                    }

                    function setCaretPosition(input, pos) {
                        if (input.offsetWidth === 0 || input.offsetHeight === 0){
                            return true; // Input's hidden
                        }
                        if (input.setSelectionRange) {
                            input.focus();
                            input.setSelectionRange(pos,pos); }
                        else if (input.createTextRange) {
                            // Curse you IE
                            var range = input.createTextRange();
                            range.collapse(true);
                            range.moveEnd('character', pos);
                            range.moveStart('character', pos);
                            range.select();
                        }
                    }

                    function getSelectionLength(input) {
                        if (input.selectionStart !== undefined){
                            return (input.selectionEnd - input.selectionStart);
                        }
                        if (document.selection){
                            return (document.selection.createRange().text.length);
                        }
                    }

                    // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf
                    if (!Array.prototype.indexOf) {
                        Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
                            "use strict";
                            if (this === null) {
                                throw new TypeError();
                            }
                            var t = Object(this);
                            var len = t.length >>> 0;
                            if (len === 0) {
                                return -1;
                            }
                            var n = 0;
                            if (arguments.length > 1) {
                                n = Number(arguments[1]);
                                if (n !== n) { // shortcut for verifying if it's NaN
                                    n = 0;
                                } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
                                    n = (n > 0 || -1) * Math.floor(Math.abs(n));
                                }
                            }
                            if (n >= len) {
                                return -1;
                            }
                            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
                            for (; k < len; k++) {
                                if (k in t && t[k] === searchElement) {
                                    return k;
                                }
                            }
                            return -1;
                        };
                    }

                }
            };
        }
    ]);

    /*Directive for rating */
    appDir.directive('starRating', function () {
        return {
            scope: {
                rating: '=',
                maxRating: '@',
                readOnly: '@',
                click: "&",
                mouseHover: "&",
                mouseLeave: "&"
            },
            restrict: 'EA',
            template:
            "<div style='display: inline-block; margin: 0px; padding: 0px; cursor:pointer;' ng-repeat='idx in maxRatings track by $index'>"+
            "<img ng-src='{{((hoverValue + _rating) <= $index) && \"img/icon/star-empty-lg.png\" || \"img/icon/star-fill-lg.png\"}}'"+
            "ng-Click='isolatedClick($index + 1)'"+
            "ng-mouseenter='isolatedMouseHover($index + 1)'"+
            "ng-mouseleave='isolatedMouseLeave($index + 1)' />"+
            "</div>",
            compile: function (element, attrs) {
                if (!attrs.maxRating || (Number(attrs.maxRating) <= 0)) {
                    attrs.maxRating = '5';
                }
            },
            controller: function ($scope, $element, $attrs) {
                $scope.maxRatings = [];

                for (var i = 1; i <= $scope.maxRating; i++) {
                    $scope.maxRatings.push({});
                }

                $scope._rating = $scope.rating;

                $scope.isolatedClick = function (param) {
                    if ($scope.readOnly == 'true') return;

                    $scope.rating = $scope._rating = param;
                    $scope.hoverValue = 0;
                    $scope.click({
                        param: param
                    });
                };

                $scope.isolatedMouseHover = function (param) {
                    if ($scope.readOnly == 'true') return;

                    $scope._rating = 0;
                    $scope.hoverValue = param;
                    $scope.mouseHover({
                        param: param
                    });
                };

                $scope.isolatedMouseLeave = function (param) {
                    if ($scope.readOnly == 'true') return;

                    $scope._rating = $scope.rating;
                    $scope.hoverValue = 0;
                    $scope.mouseLeave({
                        param: param
                    });
                };
            }
        };
    });

    appDir.directive('hideTabs', function($rootScope) {
        return {
            restrict: 'A',
            scope: {
                hideTabs: '@hideTabs',
            },
            link: function($scope, $el) {
                console.log("@hideTabs", $scope.hideTabs);
                $rootScope.tabHide = $scope.hideTabs;
            }
        };
    });

    appDir.directive('password', function () {
        return {
            template: '' +
            '<div>' +
            '    <span class="input-icon-right icon color-darkgrey" style="font-size: 22px;bottom:1px" ng-click="toggle()"><i ng-class="{\'ion-eye\' :eyeClass, \'ion-eye-disabled\' :!eyeClass, }" ></i></span>' +
            '    <ion-md-input type="password" ng-model="ngModel" ng-required="true" placeholder="{{placeholder}}" ng-minlength="4"  name="name" class="text-left left-icon" hightlight-color="dark"></ion-md-input>' +
            '</div>',
            restrict: 'E',
            replace: true,
            scope: {
                ngModel: '=',
                name: '=',
                placeholder : '@'
            },
            link: function (scope, element, attrs) {
                element[0].focus();
                scope.toggle = function () {
                    var i = element[0].getElementsByTagName('input')[0];
                    var type = i.getAttribute('type');
                    type = (type=='password') ?  'text' : 'password';
                    i.setAttribute('type', type);
                    if(type=='password')
                        scope.eyeClass = false;
                    else
                        scope.eyeClass = true;
                };
            }
        };
    });

    appDir.directive('compareTo', function () {
        return {
            require: "ngModel",
            scope: {
                otherModelValue: "=compareTo"
            },
            link: function(scope, element, attributes, ngModel) {

                ngModel.$validators.compareTo = function(modelValue) {
                    return modelValue == scope.otherModelValue;
                };

                scope.$watch("otherModelValue", function() {
                    ngModel.$validate();
                });
            }
        };
    });


    appDir.directive('dragBack', function($ionicGesture, $state) {
        return {
            restrict : 'A',
            link : function(scope, elem, attr) {

                $ionicGesture.on('swipe', function(event) {

                    console.log('Got swiped!');
                    event.preventDefault();
                    window.history.back();

                }, elem);

            }
        };
    });

    appDir.directive('checkImage', function ($q) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                attrs.$observe('ngSrc', function (ngSrc) {
                    var deferred = $q.defer();
                    var image = new Image();
                    element.addClass('image-loaded-animate-pre');
                    image.onerror = function () {
                        deferred.resolve(false);
                        element.attr('src', attrs.checkImage); // set default image
                        element.addClass('image-loaded-animate');
                    };
                    image.onload = function () {
                        element.addClass('image-loaded-animate');
                        deferred.resolve(true);
                    };
                    image.src = ngSrc;
                    return deferred.promise;
                });
            }
        };
    });

    appDir.directive('ionicRatings', ionicRatings);
    function ionicRatings() {
        return {
            restrict: 'AE',
            replace: true,
            template: '<div class="text-center ionic_ratings">' +
            '<span class="icon {{iconOff}} ionic_rating_icon_off" ng-style="iconOffColor" ng-click="ratingsClicked(1)" ng-if="rating < 1" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOn}} ionic_rating_icon_on" ng-style="iconOnColor" ng-click="ratingsUnClicked(1)" ng-if="rating > 0" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOff}} ionic_rating_icon_off" ng-style="iconOffColor" ng-click="ratingsClicked(2)" ng-if="rating < 2" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOn}} ionic_rating_icon_on" ng-style="iconOnColor" ng-click="ratingsUnClicked(2)" ng-if="rating > 1" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOff}} ionic_rating_icon_off" ng-style="iconOffColor" ng-click="ratingsClicked(3)" ng-if="rating < 3" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOn}} ionic_rating_icon_on" ng-style="iconOnColor" ng-click="ratingsUnClicked(3)" ng-if="rating > 2" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOff}} ionic_rating_icon_off" ng-style="iconOffColor" ng-click="ratingsClicked(4)" ng-if="rating < 4" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOn}} ionic_rating_icon_on" ng-style="iconOnColor" ng-click="ratingsUnClicked(4)" ng-if="rating > 3" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOff}} ionic_rating_icon_off" ng-style="iconOffColor" ng-click="ratingsClicked(5)" ng-if="rating < 5" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '<span class="icon {{iconOn}} ionic_rating_icon_on" ng-style="iconOnColor" ng-click="ratingsUnClicked(5)" ng-if="rating > 4" ng-class="{\'read_only\':(readOnly)}"></span>' +
            '</div>',
            scope: {
                ratingsObj: '=ratingsobj',
                index: '=index'
            },
            link: function(scope, element, attrs) {

                //Setting the default values, if they are not passed
                scope.iconOn = scope.ratingsObj.iconOn || 'ion-ios-star';
                scope.iconOff = scope.ratingsObj.iconOff || 'ion-ios-star-outline';
                scope.iconOnColor = scope.ratingsObj.iconOnColor || 'rgb(200, 200, 100)';
                scope.iconOffColor = scope.ratingsObj.iconOffColor || 'rgb(200, 100, 100)';
                scope.rating = scope.ratingsObj.rating || 0;
                scope.minRating = scope.ratingsObj.minRating || 0;
                scope.readOnly = scope.ratingsObj.readOnly || false;
                scope.index = scope.index || 0;

                //Setting the color for the icon, when it is active
                scope.iconOnColor = {
                    color: scope.iconOnColor
                };

                //Setting the color for the icon, when it is not active
                scope.iconOffColor = {
                    color: scope.iconOffColor
                };

                //Setting the rating
                scope.rating = (scope.rating > scope.minRating) ? scope.rating : scope.minRating;

                //Setting the previously selected rating
                scope.prevRating = 0;

                scope.$watch('ratingsObj.rating', function(newValue, oldValue) {
                    setRating(newValue);
                });

                function setRating(val, uiEvent) {
                    if (scope.minRating !== 0 && val < scope.minRating) {
                        scope.rating = scope.minRating;
                    } else {
                        scope.rating = val;
                    }
                    scope.prevRating = val;
                    if (uiEvent) scope.ratingsObj.callback(scope.rating, scope.index);
                }

                //Called when he user clicks on the rating
                scope.ratingsClicked = function(val) {
                    setRating(val, true);
                };

                //Called when he user un clicks on the rating
                scope.ratingsUnClicked = function(val) {
                    if (scope.minRating !== 0 && val < scope.minRating) {
                        scope.rating = scope.minRating;
                    } else {
                        scope.rating = val;
                    }
                    if (scope.prevRating == val) {
                        if (scope.minRating !== 0) {
                            scope.rating = scope.minRating;
                        } else {
                            scope.rating = 0;
                        }
                    }
                    scope.prevRating = val;
                    scope.ratingsObj.callback(scope.rating, scope.index);
                };
            }
        };
    }

    appDir.directive('ngDraggable', ngDraggable);
    function ngDraggable($document) {
        return {
            restrict: 'A',
            scope: {
                dragOptions: '=ngDraggable'
            },
            link: function(scope, elem, attr) {
                var startX, startY, x = 0, y = 0,
                    start, stop, drag, container, position, screenCentreX;

                var width  = elem[0].offsetWidth,
                    height = elem[0].offsetHeight;

                // Obtain drag options
                if (scope.dragOptions) {
                    start  = scope.dragOptions.start;
                    drag   = scope.dragOptions.drag;
                    stop   = scope.dragOptions.stop;
                    var id = scope.dragOptions.container;
                    if (id) {
                        container = document.querySelector(id).getBoundingClientRect();
                        screenCentreX = container.width/2;
                        if(position){
                            position = JSON.parse(scope.dragOptions.position);
                            y = position.clientY;
                            x = position.clientX;
                            setPosition();
                        }else{
                            y = container.bottom -  152;
                            x = container.right - 65;
                            setPosition();
                        }
                    }
                }

                // Bind mousedown event
                elem.on('touchstart mousedown', function(e) {
                    e.preventDefault();
                    startX = e.touches[0].clientX - elem[0].offsetLeft;
                    startY = e.touches[0].clientY - elem[0].offsetTop;
                    $document.on('touchmove mousemove', mousemove);
                    $document.on('touchend mouseup', mouseup);
                    if (start) start(e);
                });

                // Handle drag event
                function mousemove(e) {
                    y = e.touches[0].clientY - startY;
                    x = e.touches[0].clientX - startX;
                    setPosition();
                    if (drag) drag(e);
                }

                // Unbind drag events
                function mouseup(e) {

                    //if button at left side from "screenCentreX"
                    if(e.changedTouches[0].clientX < screenCentreX){
                        y = e.changedTouches[0].clientY - startY;
                        x = container.left + 5;
                        setPosition();
                    }else{
                        y = e.changedTouches[0].clientY - startY;
                        x = container.right - 65;
                        setPosition();
                    }

                    $document.unbind('touchmove mousemove', mousemove);
                    $document.unbind('touchend mouseup', mouseup);
                    if (stop) stop({'clientX' : x, 'clientY' : y});
                }

                // Move element, within container if provided
                function setPosition() {
                    if (container) {
                        if (x < container.left) {
                            x = container.left;
                        } else if (x > container.right - width) {
                            x = container.right - width;
                        }
                        if (y < container.top) {
                            y = container.top;
                        } else if (y > container.bottom - height) {
                            y = container.bottom - height;
                        }
                    }

                    elem.css({
                        top: y + 'px',
                        left:  x + 'px'
                    });
                }
            }
        };

    }

    appDir.directive('uzedLoader', uzedLoader);
    function uzedLoader() {
        return {
            template: '' +
            '<div ng-if="!value" style="display: flex;align-items: center;height:82vh;flex-direction: column;justify-content: center;"  >' +
            '<img class="ld ld-spin"  src="./img/logo.png" width="42px" />' +
            '<span class="font-x-medium " style="margin-top: 7px" >Loading...</span>' +
            '</div>',
            restrict: 'E',
            replace: true,
            scope: {
                value: '=',
                text: '='
            },
            link: function (scope, element, attrs) {
                console.log(scope.value);
            }
        };
    }


    appDir.directive('ionSearch', ionSearch);
    function ionSearch() {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                getData: '&source',
                model: '=?',
                search: '=?filter'
            },
            link: function(scope, element, attrs) {
                attrs.minLength = attrs.minLength || 0;
                scope.placeholder = attrs.placeholder || '';
                scope.search = {value: ''};

                if (attrs.class)
                    element.addClass(attrs.class);

                if (attrs.source) {
                    scope.$watch('search.value', function (newValue, oldValue) {
                        if (newValue.length > attrs.minLength) {
                            scope.getData({str: newValue}).then(function (results) {
                                scope.model = results;
                            });
                        } else {
                            scope.model = [];
                        }
                    });
                }

                scope.clearSearch = function() {
                    scope.search.value = '';
                };
            },
            template: '<div class="item-input-wrapper">' +
            '<i class="icon ion-android-search"></i>' +
            '<input type="search" placeholder="{{placeholder}}" ng-model="search.value">' +
            '<i ng-if="search.value.length > 0" ng-click="clearSearch()" class="icon ion-close"></i>' +
            '</div>'
        };
    }

    appDir.directive('ionBottomSheet', [function() {
        return {
            restrict: 'E',
            transclude: true,
            replace: true,
            controller: [function() {}],
            template: '<div class="modal-backdrop">' +
            '<div class="modal-backdrop-bg"></div>' +
            '<div class="modal-wrapper" ng-transclude></div>' +
            '</div>'
        };
    }]);

    appDir.directive('ionBottomSheetView', function() {
        return {
            restrict: 'E',
            compile: function(element) {
                element.addClass('bottom-sheet modal');
            }
        };
    });
    appDir.directive('ionItemAccordion', function($log) {
        return {
            restrict: 'E',
            replace: true,
            transclude: true,
            require: '^ionList',
            scope: {
                title: '@',
                iconClose: '@',
                iconOpen: '@',
                customClass: '@',
                iconAlign: '@'
            },
            template: '<div ng-class="customClass"><ion-item ng-class="classItem()" ng-click="toggleGroup(id)" ng-class="{active: isGroupShown(id)}">' +
            '<i class="icon font-size-18" ng-class="classGroup(id)"></i>' +
            '&nbsp;' +
            '{{title}}' +
            '</ion-item>' +
            '<ion-item class="item-accordion"  ng-show="isGroupShown(id)"><ng-transclude></ng-transclude></ion-item></div>',
            link: function(scope, element, attrs, ionList) {

                // link to parent
                if (!angular.isDefined(ionList.activeAccordion)) ionList.activeAccordion = false;
                if (angular.isDefined(ionList.counterAccordion)) {
                    ionList.counterAccordion++;
                } else {
                    ionList.counterAccordion = 1;
                    ionList.activeAccordion = true;
                }
                scope.id = ionList.counterAccordion;
                // set defaults
                if (!angular.isDefined(scope.id)) $log.error('ID missing for ion-time-accordion');
                if (!angular.isString(scope.title)) $log.warn('Title missing for ion-time-accordion');
                if (!angular.isString(scope.iconClose)) scope.iconClose = 'ion-minus';
                if (!angular.isString(scope.iconOpen)) scope.iconOpen = 'ion-plus';
                if (!angular.isString(scope.iconAlign)) scope.iconAlign = 'left';

                scope.isGroupShown = function() {
                    return (ionList.activeAccordion == scope.id);
                };

                scope.toggleGroup = function() {
                    $log.debug('toggleGroup');
                    if (ionList.activeAccordion == scope.id) {
                        ionList.activeAccordion = false;
                    } else {
                        ionList.activeAccordion = scope.id;
                    }
                };

                scope.classGroup = function() {
                    return (ionList.activeAccordion == scope.id) ? scope.iconOpen : scope.iconClose;
                };

                scope.classItem = function() {
                    return (scope.iconAlign == 'left' ? 'item-icon-left' : 'item-icon-right');
                };
            }

        };
    });
}());