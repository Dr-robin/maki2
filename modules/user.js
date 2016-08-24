'use strict';

page('POST /', ['$body'], ($body, end) => {
	end(null, $body, 'test');
});