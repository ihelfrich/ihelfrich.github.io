import unittest
from graph_contract import contract_graph

class ContractionTests(unittest.TestCase):
    def test_parallel_chain_preserves_cheapest_connection(self):
        edges=[(0,1,2,-1),(1,0,2,-1),(1,2,5,-1),(1,2,3,-1),(2,1,3,-1)]
        kept,remap,compressed=contract_graph(edges,{0,2})
        self.assertEqual(kept,[0,2])
        self.assertEqual(compressed,{(0,1,-1):5,(1,0,-1):5})
    def test_directed_chain_does_not_invent_reverse_route(self):
        _,_,compressed=contract_graph([(0,1,2,-1),(1,2,3,-1)],{0,2})
        self.assertEqual(compressed,{(0,1,-1):5})
    def test_intervention_boundaries_survive(self):
        kept,_,compressed=contract_graph([(0,1,2,-1),(1,2,3,0),(2,3,4,-1)],{0,3})
        self.assertEqual(kept,[0,1,2,3])
        self.assertEqual(compressed[(1,2,0)],3)
    def test_dead_end_does_not_create_a_connection(self):
        _,_,compressed=contract_graph([(0,1,2,-1),(2,1,3,-1)],{0,2})
        self.assertEqual(compressed,{})

if __name__=='__main__':unittest.main()
