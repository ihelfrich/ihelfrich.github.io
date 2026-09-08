import math
import unittest
from build_city import project, parse_height, walking_allowed, stitch_rings, build_graph, relation_polygons

class DataTransforms(unittest.TestCase):
    def test_projection_direction_distance_and_origin(self):
        self.assertEqual(project(-90.193,38.628), [0.0, -0.0])
        x,z=project(-90.192,38.629)
        self.assertAlmostEqual(x,111.195*math.cos(math.radians(38.628)),places=5)
        self.assertAlmostEqual(z,-111.195,places=5)
    def test_metric_imperial_and_invalid_heights(self):
        self.assertAlmostEqual(parse_height('100 ft'),30.48)
        self.assertAlmostEqual(parse_height("10' 6\""),3.2004)
        self.assertEqual(parse_height('23 m'),23.0)
        self.assertIsNone(parse_height('unknown'))
        self.assertIsNone(parse_height('-4'))
    def test_walking_barriers(self):
        self.assertFalse(walking_allowed({'highway':'motorway'}))
        self.assertFalse(walking_allowed({'highway':'residential','access':'private'}))
        self.assertFalse(walking_allowed({'highway':'service','foot':'no'}))
        self.assertFalse(walking_allowed({'highway':'construction'}))
        self.assertTrue(walking_allowed({'highway':'path','foot':'yes'}))
    def test_split_hole_ring_stitch(self):
        rings, unresolved=stitch_rings([[1,2,3],[1,4,3]])
        self.assertEqual(unresolved,0)
        self.assertEqual(len(rings),1)
        self.assertEqual(rings[0][0],rings[0][-1])
        self.assertEqual(set(rings[0]),{1,2,3,4})
        rings, unresolved=stitch_rings([[5,6],[7,8]])
        self.assertEqual(rings,[])
        self.assertEqual(unresolved,2)

class GraphAndPolygonFixtures(unittest.TestCase):
    def test_grade_separated_crossing_uses_ids_and_blocked_node_has_no_edges(self):
        def n(lon,lat,**tags): return {'lon':lon,'lat':lat,'tags':tags}
        nodes={'a':n(-90.194,38.628),'b':n(-90.192,38.628),
               'c':n(-90.193,38.627),'d':n(-90.193,38.629),
               'e':n(-90.192,38.629,barrier='fence')}
        ways={'one':{'refs':['a','b'],'tags':{'highway':'footway'}},
              'two':{'refs':['c','d'],'tags':{'highway':'footway','bridge':'yes'}},
              'three':{'refs':['b','e'],'tags':{'highway':'footway'}}}
        graph,ids,skipped=build_graph(nodes,ways)
        self.assertEqual(len(graph['edges']),2)
        self.assertNotIn('e',ids)
        endpoints=[{ids[a],ids[b]} for a,b,_ in graph['edges']]
        self.assertEqual(endpoints,[{'a','b'},{'c','d'}])
    def test_relation_hole_subtracts_area_and_missing_member_excludes_relation(self):
        # Local offsets are degrees; only area ratios are asserted here.
        coords={'a':(0,0),'b':(.004,0),'c':(.004,.004),'d':(0,.004),
                'e':(.001,.001),'f':(.003,.001),'g':(.003,.003),'h':(.001,.003)}
        nodes={k:{'lon':-90.193+x,'lat':38.628+y,'tags':{}} for k,(x,y) in coords.items()}
        ways={'o':{'refs':['a','b','c','d','a'],'tags':{}},
              'i1':{'refs':['e','f','g'],'tags':{}},'i2':{'refs':['e','h','g'],'tags':{}}}
        rel={'members':[{'type':'way','ref':'o','role':'outer'},
                        {'type':'way','ref':'i1','role':'inner'},
                        {'type':'way','ref':'i2','role':'inner'}],'tags':{}}
        polygons,error=relation_polygons(rel,ways,nodes)
        self.assertIsNone(error)
        self.assertEqual(len(polygons),1)
        self.assertEqual(len(polygons[0].interiors),1)
        self.assertAlmostEqual(polygons[0].area/polygons[0].envelope.area,.75,places=6)
        del ways['i2']
        polygons,error=relation_polygons(rel,ways,nodes)
        self.assertEqual(polygons,[])
        self.assertIsNotNone(error)

if __name__=='__main__': unittest.main()
